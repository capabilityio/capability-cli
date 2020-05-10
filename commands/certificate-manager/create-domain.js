/*
 * Copyright 2018-2019 Capability LLC. All Rights Reserved.
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
const CapabilityURI = require("capability-uri");
const certificateManager = require("../certificate-manager.js");

exports.command = "create-domain";

exports.desc = "Create domain.";

exports.builder = function(yargs)
{
    const group = "Create Domain:";
    return yargs
        .option("domain",
            {
                group,
                describe: "Fully qualified domain name.",
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        )
        .option("receive-certificate-capability",
            {
                group,
                describe: "Capability the Certificate Manager Service will use to deliver the created certificate.",
                coerce: opt =>
                {
                    const capabilityURI = CapabilityURI.parse(opt);
                    if (!capabilityURI)
                    {
                        throw new Error("Failed parsing receive-certificate-capability");
                    }
                    return opt;
                },
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        )
        .option("update-challenge-capability",
            {
                group,
                describe: "Capability the Certificate Manager Service will use to provide a challenge in order to verify domain name ownership.",
                coerce: opt =>
                {
                    const capabilityURI = CapabilityURI.parse(opt);
                    if (!capabilityURI)
                    {
                        throw new Error("Failed parsing update-challenge-capability");
                    }
                    return opt;
                },
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        );
};

exports.handler = function(args)
{
    const capability = certificateManager.capability(args, "createDomain");
    const service = new CapabilitySDK.CertificateManager(
        {
            tls:
            {
                trustedCA: args["trustedCA-file-path"]
            }
        }
    );
    service.createDomain(capability,
        {
            domain: args.domain,
            capabilities:
            {
                receiveCertificate: args["receive-certificate-capability"],
                updateChallenge: args["update-challenge-capability"]
            }
        },
        (error, resp) =>
        {
            if (error)
            {
                return certificateManager.error(error);
            }
            console.log(JSON.stringify(resp, null, 2));
        }
    );
};
