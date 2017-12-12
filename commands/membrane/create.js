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

const CapabilitySdk = require("capability-sdk");
const membrane = require("../membrane.js");

exports.command = "create";

exports.desc = "Create membrane.";

exports.builder = function(yargs)
{
    const group = "Create:";
    return yargs.option("id",
        {
            group,
            describe: "Membrane id.",
            demandOption: true,
            requiresArg: true,
            type: "string"
        }
    );
};

exports.handler = function(args)
{
    const capability = membrane.capability(args, "create");
    const service = new CapabilitySdk.Membrane(
        {
            tls:
            {
                rejectUnauthorized: !args["tls-self-signed"]
            }
        }
    );
    service.create(capability,
        {
            id: args.id
        },
        (error, response) =>
        {
            if (error)
            {
                return membrane.error(error);
            }
            console.log(JSON.stringify(response, null, 2));
        }
    );
};
