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

const config = require("../config.js");
const services = require("../../services.js");

exports.command = "list";

exports.describe = "List configuration.";

exports.builder = function(yargs)
{
    return yargs.option("service",
        {
            group: "List:",
            describe: "Capability service to list configuration for.",
            requiresArg: true,
            type: "string",
            choices: services
        }
    );
};

exports.handler = function(args)
{
    const savedConfig = config.loadConfig();
    const savedCredentials = config.loadCredentials();
    const output =
    {
        profile: args.profile
    };
    if (savedConfig && savedConfig[args.profile])
    {
        if (!args.service)
        {
            Object.keys(savedConfig[args.profile])
                .map(service =>
                    {
                        output[service] = savedConfig[args.profile][service];
                    }
                );
        }
        else if (savedConfig[args.profile][args.service])
        {
            output[args.service] = savedConfig[args.profile][args.service];
        }
    }
    if (savedCredentials && savedCredentials[args.profile])
    {
        if (!args.service)
        {
            Object.entries(savedCredentials[args.profile])
                .map(([prop, value]) =>
                    {
                        if (prop == "profile")
                        {
                            output.profile = value;
                        }
                        else
                        {
                            const service = prop;
                            output[service] = output[service] || {};
                            output[service].capabilities = Object.entries(value.capabilities)
                                .reduce((capabilities, [name, capability]) =>
                                    {
                                        capabilities[name] = config.secretPreview(capability);
                                        return capabilities;
                                    },
                                    {}
                                );
                        }
                    }
                );
        }
        else if (savedCredentials[args.profile][args.service])
        {
            output.profile = output.profile || args.profile;
            output[args.service] = output[args.service] || {};
            output[args.service].capabilities = Object.entries(savedCredentials[args.profile][args.service].capabilities)
                .reduce((capabilities, [name, capability]) =>
                    {
                        capabilities[name] = config.secretPreview(capability);
                        return capabilities;
                    },
                    {}
                );
        }
    }
    console.log(JSON.stringify(output, null, 2));
};
