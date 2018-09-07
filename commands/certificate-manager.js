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

const CapabilityURI = require("capability-uri");
const config = require("./config.js");
const fs = require("fs");
const path = require("path");

exports.command = "certificate-manager <command>";

exports.desc = "Certificate Manager Service operations.";

exports.buider = function(yargs)
{
    const group = "Certificate Manager:";
    return yargs.commandDir("certificate-manager")
        .demandCommand()
        .option("capability",
            {
                group,
                describe: "Capability to use.",
                coerce: opt =>
                {
                    const capabilityURI = CapabilityURI.parse(opt);
                    if (!capabilityURI)
                    {
                        throw new Error("Failed parsing capability");
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
        .option("trustedCA-file-path",
            {
                group,
                describe: "File path to trusted Certificate Authorities in JSON format",
                coerce: opt => JSON.parse(fs.readFileSync(path.normalize(opt), "utf8")),
                type: "string"
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
        if (config.capabilityExists(savedCredentials, args.profile, "certificate-manager", name))
        {
            return savedCredentials[args.profile]["certificate-manager"].capabilities[name];
        }
    }
    console.error("FAILED");
    console.error(`No certificate-manager "${name}" capability found for profile "${args.profile}"`);
    process.exit(1);
};

exports.error = error =>
{
    console.error("FAILED");
    console.error(error.message);
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
};
