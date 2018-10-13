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

exports.command = "describe";

exports.desc = "Describe.";

exports.builder = function(yargs)
{
    const group = "Describe:";
    return yargs.option("config-version",
        {
            group,
            describe: "Integration configuration version to describe.",
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
            nextToken: undefined,
            stackName: args["config-version"] ? `certificate-manager-integration-${args["config-version"]}` : undefined,
            stacks: []
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
            return workflow.emit("retrieve stacks", dataBag);
        }
    );
    workflow.on("retrieve stacks", dataBag =>
        {
            const params =
            {
                NextToken: dataBag.nextToken,
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
                        if (dataBag.stackName)
                        {
                            console.error(`Not Found: ${dataBag.stackName}`);
                        }
                        else
                        {
                            console.error(`Not Found: did not find any integration configurations`);
                        }
                        return process.exit(1);
                    }
                    dataBag.stacks = dataBag.stacks.concat(
                        data.Stacks.filter(stack =>
                            {
                                let provider = false;
                                let service = false;
                                let component = false;
                                if (stack.Tags)
                                {
                                    stack.Tags.map(tag =>
                                        {
                                            switch (tag.Key)
                                            {
                                                case "provider":
                                                    tag.Value == "capability.io" ? (provider = true) : null;
                                                    break;
                                                case "service":
                                                    tag.Value == "certificate-manager" ? (service = true) : null;
                                                    break;
                                                case "service:component":
                                                    tag.Value == "aws-integration" ? (component = true) : null;
                                                    break;
                                            }
                                        }
                                    );
                                }
                                return provider && service && component;
                            }
                        )
                    );
                    if (data.NextToken)
                    {
                        dataBag.nextToken = data.NextToken;
                        return workflow.emit("retrieve stacks", dataBag);
                    }
                    console.log(JSON.stringify(dataBag.stacks, null, 2));
                }
            );
        }
    );
};
