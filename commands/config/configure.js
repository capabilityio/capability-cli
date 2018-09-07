/*
 * Copyright 2017-2018 Capability LLC. All Rights Reserved.
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
const config = require("../config.js");
const events = require("events");
const prompt = require("prompt");
const regions = require("../../regions.js");
const services = require("../../services.js");

exports.command = "configure";

exports.describe = "Configure Capability CLI (capi) service.";

exports.builder = function(yargs)
{
    return yargs.option("service",
        {
            group: "Configure:",
            describe: "Capability service to configure.",
            demandOption: true,
            requiresArg: true,
            type: "string",
            choices: services
        }
    );
};

exports.handler = function(args)
{
    let savedRegion;
    const savedConfig = config.loadConfig();
    const savedCredentials = config.loadCredentials();
    if (config.propertyExists(savedConfig, args.profile, args.service, "region"))
    {
        savedRegion = savedConfig[args.profile][args.service].region;
    }
    const schema  =
    {
        properties:
        {
            region:
            {
                description: "default region name:",
                pattern: config.CONFIG_PATTERNS.region,
                message: `Region must be one of: ${regions.join(",")}`,
                default: savedRegion ? savedRegion : "amzn-us-east-1",
                before: value =>
                {
                    return value.trim();
                }
            }
        }
    }
    switch (args.service)
    {
        case "membrane":
            config.SERVICE_CAPABILITIES.membrane
                .map(name =>
                    {
                        schema.properties[name] =
                        {
                            description: `${name} capability: ${config.secretPreview(savedCredentials, args.profile, args.service, name)}`,
                            pattern: CapabilityURI.NON_CUSTOM_URI_REGEX,
                            message: `Please enter your "${name}" capability for membrane service or skip by pressing enter`
                        }
                    }
                );
            break;
    }
    const workflow = new events.EventEmitter();
    setImmediate(() => workflow.emit("start"));
    workflow.on("start", () =>
        {
            prompt.message = "";
            prompt.delimiter = "";
            prompt.colors = false;
            prompt.start();

            prompt.get(schema, (error, result) =>
                {
                    if (error)
                    {
                        throw error;
                    }
                    workflow.emit("input received", result);
                }
            );
        }
    );
    workflow.on("input received", result =>
        {
            const newConfig = savedConfig || {};
            newConfig[args.profile] = newConfig[args.profile] || {};
            newConfig[args.profile].profile = args.profile;
            newConfig[args.profile][args.service] = newConfig[args.profile][args.service] || {};
            config.CONFIG_PROPERTIES.map(prop =>
                {
                    newConfig[args.profile][args.service][prop] = result[prop];
                }
            );

            const newCredentials = savedCredentials || {};
            newCredentials[args.profile] = newCredentials[args.profile] || {};
            newCredentials[args.profile].profile = args.profile;
            newCredentials[args.profile][args.service] = newCredentials[args.profile][args.service] || {};
            newCredentials[args.profile][args.service].capabilities = newCredentials[args.profile][args.service].capabilities || {};
            config.SERVICE_CAPABILITIES[args.service].map(name =>
                {
                    if (result[name])
                    {
                        newCredentials[args.profile][args.service].capabilities[name] = result[name];
                    }
                }
            );

            config.saveConfig(newConfig);
            config.saveCredentials(newCredentials);
        }
    );
};
