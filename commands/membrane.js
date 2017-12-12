/*
 * Copyright 2017 Capability LLC. All Rights Reserved.
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

const CapabilityUri = require("capability-uri");
const config = require("./config.js");

exports.command = "membrane <command>";

exports.desc = "Membrane Service operations.";

exports.builder = function(yargs)
{
    const group = "Membrane:";
    return yargs.commandDir("membrane")
        .demandCommand()
        .option("capability",
            {
                group,
                describe: "Capability to use.",
                coerce: opt =>
                {
                    const capabilityUri = CapabilityUri.parse(opt);
                    if (!capabilityUri)
                    {
                        throw new Error(`Failed parsing capability`);
                    }
                    return opt;
                },
                requiresArg: true,
                type: "string"
            }
        )
        .option("profile",
            {
                group,
                describe: "Capability profile to use.",
                default: "default",
                requiresArg: true,
                type: "string"
            }
        )
        .option("tls-self-signed",
            {
                group,
                describe: "Set to true to not check Membrane Service TLS certificate validity",
                default: false,
                type: "boolean"
            }
        );
};

exports.handler = function(args) {};

exports.capability = (args, name) =>
{
    if (args.capability)
    {
        return args.capability;
    }
    else
    {
        const savedCredentials = config.loadCredentials();
        if (config.capabilityExists(savedCredentials, args.profile, "membrane", name))
        {
            return savedCredentials[args.profile].membrane.capabilities[name];
        }
    }
    console.error("FAILED");
    console.error(`No membrane "${name}" capability found for profile "${args.profile}"`);
    process.exit(1);
};

exports.error = error =>
{
    console.error("FAILED");
    console.error(error.message);
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
};
