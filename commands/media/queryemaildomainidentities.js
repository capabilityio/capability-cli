/*
 * Copyright 2019 Capability LLC. All Rights Reserved.
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
const media = require("../media.js");

exports.command = "queryemaildomainidentities";

exports.desc = "Query EmailDomainIdentities.";

exports.builder = function(yargs)
{
    const group = "Query EmailDomainIdentities:";
    return yargs
        .option("domain",
            {
                group,
                describe: "Domain to query for.",
                requiresArg: true,
                type: "string"
            }
        )
        .option("last-domain",
            {
                group,
                describe: "Last domain from previous query.",
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
                        throw new Error("--limit must be greater than 0");
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
    const capability = media.capability(args, "queryEmailDomainIdentities");
    const service = new CapabilitySDK.Media(
        {
            tls:
            {
                trustedCA: args["trustedCA-file-path"]
            }
        }
    );
    const query =
    {
        domain: args.domain,
        lastDomain: args["last-domain"],
        limit: args.limit
    };
    Object.keys(query).map(key =>
        {
            if (query[key] === undefined)
            {
                delete query[key];
            }
        }
    );
    service.queryEmailDomainIdentities(capability, query, (error, resp) =>
        {
            if (error)
            {
                return media.error(error);
            }
            console.log(JSON.stringify(resp, null, 2));
        }
    );
};
