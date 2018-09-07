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

const CapabilitySDK = require("capability-sdk");
const membrane = require("../membrane.js");

exports.command = "query";

exports.desc = "Query membranes.";

exports.builder = function(yargs)
{
    const group = "Query:";
    return yargs.option("id",
            {
                group,
                describe: "Membrane id to query for.",
                requiresArg: true,
                type: "string"
            }
        )
        .option("last-id",
            {
                group,
                describe: "Id of the last membrane from previous query.",
                requiresArg: true,
                type: "string"
            }
        )
        .option("limit",
            {
                group,
                describe: "Limit number of results.",
                coerce: opt =>
                {
                    if (parseInt(opt) <= 0)
                    {
                        throw new Error(`--limit must be greater than 0`);
                    }
                    return parseInt(opt);
                },
                requiresArg: true,
                type: "number"
            }
        );
};

exports.handler = function(args)
{
    const capability = membrane.capability(args, "query");
    const service = new CapabilitySDK.Membrane(
        {
            tls:
            {
                rejectUnauthorized: !args["tls-self-signed"]
            }
        }
    );
    const params =
    {
        id: args.id,
        lastId: args["last-id"],
        limit: args.limit
    };
    Object.keys(params).map(key =>
        {
            if (params[key] === undefined)
            {
                delete params[key];
            }
        }
    );
    service.query(capability, params, (error, response) =>
        {
            if (error)
            {
                return membrane.error(error);
            }
            console.log(JSON.stringify(response, null, 2));
        }
    );
};
