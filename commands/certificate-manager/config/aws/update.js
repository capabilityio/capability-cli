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
const crypto = require("crypto");
const events = require("events");
const fs = require("fs");
const path = require("path");

exports.command = "update";

exports.desc = "Update.";

exports.builder = function(yargs)
{
    const group = "Update:";
    return yargs.option("config-version",
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
            profile: args["amzn-profile"]
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
            stackName: `certificate-manager-integration-${args["config-version"]}`
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
            return workflow.emit("discover latest certificate-recipient version", dataBag);
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
                    return workflow.emit("retrieve current stack", dataBag);
                }
            );
        }
    );
    workflow.on("retrieve current stack", dataBag =>
        {
            const params =
            {
                StackName: dataBag.stackName
            };
            dataBag.aws.cloudformation.describeStacks(params, (error, data) =>
                {
                    if (error)
                    {
                        console.error(JSON.stringify(error, null, 2));
                        return process.exit(1);
                    }
                    if (data.Stacks.length == 0)
                    {
                        console.error("FAILED");
                        console.error(`Not Found: ${dataBag.stackName}`);
                        return process.exit(1);
                    }
                    dataBag.stack = data.Stacks[0];
                    return workflow.emit("read cloudformation template", dataBag);
                }
            );
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
            return workflow.emit("update stack", dataBag);
        }
    );
    workflow.on("update stack", dataBag =>
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
                                case "CertificateRecipientLambdaVersion":
                                    delete param.UsePreviousValue;
                                    param.ParameterValue = dataBag.latest.certificateRecipient
                                    break;
                                case "Route53DNSChallengeUpdaterLambdaVersion":
                                    delete param.UsePreviousValue;
                                    param.ParameterValue = dataBag.latest.challengeUpdater;
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
