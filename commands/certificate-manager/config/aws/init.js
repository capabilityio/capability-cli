/*
 * Copyright 2018 Capability LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

const AWS = require("aws-sdk");
const awsCommand = require("../aws.js");
const CapabilitySDK = require("capability-sdk");
const crypto = require("crypto");
const events = require("events");
const fs = require("fs");
const membraneCommand = require("../../../membrane.js");
const path = require("path");

exports.command = "init";

exports.desc = "Initialize.";

exports.builder = function(yargs)
{
    const group = "Initialize:";
    return yargs
        .option("certificates-s3-bucket-name-prefix",
            {
                group,
                describe: "Prefix for the name of the S3 bucket that will contain your certificates. Full name will be this prefix with version appended at the end.",
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        )
        .option("config-version",
            {
                group,
                describe: "Version string to uniquely identify integration configuration.",
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        );
};

exports.handler = function(args)
{
    const awsCredentials = new AWS.SharedIniFileCredentials(
        {
            profile: args["aws-profile"]
        }
    );
    AWS.config.credentials = awsCredentials;
    const workflow = new events.EventEmitter();
    setImmediate(() => workflow.emit("start",
        {
            latest:
            {
                certificateRecipient: undefined,
                challengeUpdater: undefined
            },
            callerType: "user",
            userdata:
            {
                route53DNSChallengeUpdater: undefined
            }
        }
    ));
    workflow.on("start", dataBag => workflow.emit("assume role if needed", dataBag));
    workflow.on("assume role if needed", dataBag =>
        {
            if (args["aws-assume-role-account"])
            {
                return workflow.emit("assume role", dataBag);
            }
            return workflow.emit("setup aws-sdk", dataBag);
        }
    );
    workflow.on("assume role", dataBag =>
        {
            const params =
            {
                DurationSeconds: 900, // smallest available as of 20171010
                RoleArn: `arn:aws:iam::${args["aws-assume-role-account"]}:role/${args["aws-assume-role-name"]}`,
                RoleSessionName: crypto.randomBytes(32).toString("hex")
            };
            AWS.config.credentials = new AWS.TemporaryCredentials(params);
            dataBag.callerType = "role"
            return workflow.emit("setup aws-sdk", dataBag);
        }
    );
    workflow.on("setup aws-sdk", dataBag =>
        {
            const conf =
            {
                region: args["aws-region"]
            };
            dataBag.aws =
            {
                cloudformation: new AWS.CloudFormation(conf),
                s3: new AWS.S3(conf),
                sts: new AWS.STS(conf)
            };
            return workflow.emit("get caller identity", dataBag);
        }
    );
    workflow.on("get caller identity", dataBag =>
        {
            dataBag.aws.sts.getCallerIdentity({}, (error, data) =>
                {
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return process.exit(1);
                    }
                    dataBag.callerIdentity = data.UserId.split(":")[0];
                    return workflow.emit("discover latest certificate-recipient version", dataBag);
                }
            );
        }
    );
    workflow.on("discover latest certificate-recipient version", dataBag =>
        {
            console.error(`Retrieving latest certificate-recipient version`);
            const params =
            {
                Bucket: awsCommand.PUBLIC_LAMBDAS_S3_BUCKET,
                Key: `${awsCommand.CERTIFICATE_RECIPIENT_COMPONENT}/latest`
            };
            dataBag.aws.s3.getObject(params, (error, data) =>
                {
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return process.exit(1);
                    }
                    dataBag.latest.certificateRecipient = data.Body.toString("utf8");
                    console.error(`Retrieved latest certificate-recipient version: ${dataBag.latest.certificateRecipient}`);
                    return workflow.emit("discover latest challenge-updater version", dataBag);
                }
            );
        }
    );
    workflow.on("discover latest challenge-updater version", dataBag =>
        {
            console.error(`Retrieving latest challenge-updater version`);
            const params =
            {
                Bucket: awsCommand.PUBLIC_LAMBDAS_S3_BUCKET,
                Key: `${awsCommand.CHALLENGE_UPDATER_COMPONENT}/latest`
            };
            dataBag.aws.s3.getObject(params, (error, data) =>
                {
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return process.exit(1);
                    }
                    dataBag.latest.challengeUpdater = data.Body.toString("utf8");
                    console.error(`Retrieved latest challenge-updater version: ${dataBag.latest.challengeUpdater}`);
                    return workflow.emit("generate route53DNSChallengeUpdater userdata", dataBag);
                }
            );
        }
    );
    workflow.on("generate route53DNSChallengeUpdater userdata", dataBag =>
        {
            const userdata =
            {
                stderrTelemetry: true
            };
            if (args["trustedCA-file-path"])
            {
                userdata.tls =
                {
                    trustedCA: args["trustedCA-file-path"]
                }
            }
            dataBag.userdata.route53DNSChallengeUpdater = JSON.stringify(userdata);
            return workflow.emit("read cloudformation template", dataBag);
        }
    );
    workflow.on("read cloudformation template", dataBag =>
        {
            dataBag.template = fs.readFileSync(
                path.normalize(
                    path.join(
                        __dirname, "cloudformation.yaml"
                    )
                )
            ).toString("utf8");
            return workflow.emit("create stack", dataBag);
        }
    );
    workflow.on("create stack", dataBag =>
        {
            dataBag.stackName = `certificate-manager-integration-${args["config-version"]}`;
            console.error(`Creating ${dataBag.stackName} AWS CloudFormation stack`);
            const params =
            {
                StackName: dataBag.stackName,
                TemplateBody: dataBag.template,
                Capabilities:
                [
                    "CAPABILITY_IAM",
                    "CAPABILITY_NAMED_IAM"
                ],
                Parameters:
                [
                    {
                        ParameterKey: "CallerIdentity",
                        ParameterValue: dataBag.callerType == "user" ? dataBag.callerIdentity : `${dataBag.callerIdentity}:*`
                    },
                    {
                        ParameterKey: "CertificateRecipientLambdaVersion",
                        ParameterValue: dataBag.latest.certificateRecipient
                    },
                    {
                        ParameterKey: "CertificatesS3BucketName",
                        ParameterValue: args["certificates-s3-bucket-name-prefix"]
                    },
                    {
                        ParameterKey: "Route53DNSChallengeUpdaterLambdaUserData",
                        ParameterValue: dataBag.userdata.route53DNSChallengeUpdater
                    },
                    {
                        ParameterKey: "Route53DNSChallengeUpdaterLambdaVersion",
                        ParameterValue: dataBag.latest.challengeUpdater
                    },
                    {
                        ParameterKey: "Version",
                        ParameterValue: args["config-version"]
                    }
                ],
                Tags:
                [
                    {
                        Key: "provider",
                        Value: "capability.io"
                    },
                    {
                        Key: "service",
                        Value: "certificate-manager"
                    },
                    {
                        Key: "service:component",
                        Value: "aws-integration"
                    },
                    {
                        Key: "service:component:version",
                        Value: args["config-version"]
                    }
                ]
            };
            dataBag.aws.cloudformation.createStack(params, (error, data) =>
                {
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return workflow.emit("show stack events", dataBag);
                    }
                    return workflow.emit("wait on stack creation", dataBag);
                }
            );
        }
    );
    workflow.on("wait on stack creation", dataBag =>
        {
            process.stderr.write("...");
            let interval = setInterval(() => process.stderr.write("."), 5000);
            const params =
            {
                StackName: dataBag.stackName
            };
            dataBag.aws.cloudformation.waitFor("stackCreateComplete", params, (error, data) =>
                {
                    clearInterval(interval);
                    console.error();
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return workflow.emit("show stack events", dataBag);
                    }
                    console.error(`Creating ${dataBag.stackName} AWS CloudFormation stack SUCCEEDED`);
                    dataBag.stack = data.Stacks[0];
                    dataBag.awsAccessKeyId = dataBag.stack.Outputs.filter(output => output.OutputKey == "CertificateManagerServiceUserAccessKeyId")[0].OutputValue;
                    dataBag.certificateRecipientLambdaName = dataBag.stack.Outputs.filter(output => output.OutputKey == "CertificateRecipientLambda")[0].OutputValue;
                    dataBag.challengeUpdaterLambdaName = dataBag.stack.Outputs.filter(output => output.OutputKey == "Route53DNSChallengeUpdaterLambda")[0].OutputValue;
                    dataBag.secretAccessKey = dataBag.stack.Outputs.filter(output => output.OutputKey == "CertificateManagerServiceUserSecretAccessKey")[0].OutputValue;
                    return workflow.emit("create membrane", dataBag);
                }
            );
        }
    );
    workflow.on("create membrane", dataBag =>
        {
            const membraneName = `certificate-manager-integration-${args["config-version"]}`;
            console.error(`Creating ${membraneName} membrane`);
            const capability = membraneCommand.capability(args, "create");
            dataBag.membraneService = new CapabilitySDK.Membrane(
                {
                    tls:
                    {
                        trustedCA: args["trustedCA-file-path"]
                    }
                }
            );
            dataBag.membraneService.create(capability,
                {
                    id: membraneName
                },
                (error, response) =>
                {
                    if (error)
                    {
                        return membraneCommand.error(error);
                    }
                    console.error(`Creating ${membraneName} membrane SUCCEEDED`);
                    dataBag.membrane = response;
                    return workflow.emit("export ReceiveCertificate capability", dataBag);
                }
            );
        }
    );
    workflow.on("export ReceiveCertificate capability", dataBag =>
        {
            console.error(`Exporting ReceiveCertificate capability`);
            dataBag.commonCapabilityConfig =
            {
                method: "POST",
                hmac:
                {
                    "aws4-hmac-sha256":
                    {
                        awsAccessKeyId: dataBag.awsAccessKeyId,
                        region: args["aws-region"],
                        service: "lambda",
                        secretAccessKey: dataBag.secretAccessKey
                    }
                },
                allowQuery: false
            };
            dataBag.membraneService.export(
                dataBag.membrane.capabilities.export,
                Object.assign({}, dataBag.commonCapabilityConfig,
                    {
                        headers:
                        {
                            "X-Amz-Invocation-Type": "RequestResponse",
                            "X-Amz-Log-Type": "None"
                        },
                        uri: `https://lambda.${args["aws-region"]}.amazonaws.com/2015-03-31/functions/${dataBag.certificateRecipientLambdaName}/invocations`
                    }
                ),
                (error, response) =>
                {
                    if (error)
                    {
                        return membraneCommand.error(error);
                    }
                    console.error(`Exporting ReceiveCertificate capability SUCCEEDED`);
                    dataBag.receiveCertificateCapability = response.capability;
                    return workflow.emit("export UpdateChallenge capability", dataBag);
                }
            );
        }
    );
    workflow.on("export UpdateChallenge capability", dataBag =>
        {
            console.error(`Exporting UpdateChallenge capability`);
            dataBag.membraneService.export(
                dataBag.membrane.capabilities.export,
                Object.assign({}, dataBag.commonCapabilityConfig,
                    {
                        headers:
                        {
                            "X-Amz-Invocation-Type": "Event",
                            "X-Amz-Log-Type": "None"
                        },
                        uri: `https://lambda.${args["aws-region"]}.amazonaws.com/2015-03-31/functions/${dataBag.challengeUpdaterLambdaName}/invocations`
                    }
                ),
                (error, response) =>
                {
                    if (error)
                    {
                        return membraneCommand.error(error);
                    }
                    console.error(`Exporting UpdateChallenge capability SUCCEEDED`);
                    dataBag.updateChallengeCapability = response.capability;
                    return workflow.emit("set active capabilities", dataBag);
                }
            );
        }
    );
    workflow.on("set active capabilities", dataBag =>
        {
            const params =
            {
                StackName: dataBag.stack.StackName,
                TemplateBody: dataBag.template,
                Capabilities: dataBag.stack.Capabilities,
                Parameters: dataBag.stack.Parameters
                    .map(param =>
                        {
                            delete param.ParameterValue;
                            param.UsePreviousValue = true;
                            return param;
                        }
                    )
                    .map(param =>
                        {
                            switch (param.ParameterKey)
                            {
                                case "ReceiveCertificateCapability":
                                    param.ParameterValue = dataBag.receiveCertificateCapability;
                                    delete param.UsePreviousValue;
                                    break;
                                case "UpdateChallengeCapability":
                                    param.ParameterValue = dataBag.updateChallengeCapability;
                                    delete param.UsePreviousValue;
                                    break;
                            }
                            return param;
                        }
                    ),
                Tags: dataBag.stack.Tags
            };
            dataBag.aws.cloudformation.updateStack(params, (error, data) =>
                {
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return process.exit(1);
                    }
                    return workflow.emit("wait on stack update", dataBag);
                }
            );
        }
    );
    workflow.on("wait on stack update", dataBag =>
        {
            console.error(`Updating ${dataBag.stackName} AWS CloudFormation stack`);
            process.stderr.write("...");
            let interval = setInterval(() => process.stderr.write("."), 5000);
            const params =
            {
                StackName: dataBag.stackName
            };
            dataBag.aws.cloudformation.waitFor("stackUpdateComplete", params, (error, data) =>
                {
                    clearInterval(interval);
                    console.error();
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return workflow.emit("show stack events", dataBag);
                    }
                    console.error(`Updating ${dataBag.stackName} AWS CloudFormation stack SUCCEEDED`);
                    console.log(
                        JSON.stringify(
                            {
                                capabilities:
                                {
                                    receiveCertificate: dataBag.receiveCertificateCapability,
                                    updateChallenge: dataBag.updateChallengeCapability
                                }
                            },
                            null,
                            2
                        )
                    );
                }
            );
        }
    );
    workflow.on("show stack events", dataBag =>
        {
            const params =
            {
                StackName: dataBag.stackName
            };
            dataBag.aws.cloudformation.describeStackEvents(params, (error, data) =>
                {
                    if (error)
                    {
                        console.error();
                        console.error(JSON.stringify(error, null, 2));
                        console.error(`Unable to retrieve error details`);
                        return;
                    }
                    console.error();
                    console.error(
                        data.StackEvents.map(event => `${event.Timestamp} ${event.ResourceStatus} ${event.ResourceType} ${event.ResourceStatusReason ? `- ${event.ResourceStatusReason}` : ""}`).join("\n")
                    );
                    return process.exit(1);
                }
            );
        }
    );
};
