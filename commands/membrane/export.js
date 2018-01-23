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
const CapabilityUri = require("capability-uri");
const membrane = require("../membrane.js");

exports.command = "export";

exports.desc = "Export capability through membrane.";

exports.builder = function(yargs)
{
    const group = "Export:";
    return yargs
        .option("allow-query",
            {
                group,
                describe: "Append requester's URI query string to requests.",
                default: undefined,
                conflicts: "capability-to-export",
                implies: "uri",
                type: "boolean"
            }
        )
        .option("capability-to-export",
            {
                group,
                describe: "Existing capability to re-export through the membrane.",
                coerce: opt =>
                {
                    const capabilityUri = CapabilityUri.parse(opt);
                    if (!capabilityUri)
                    {
                        throw new Error(`Failed parsing capability-to-export`);
                    }
                    return opt;
                },
                conflicts:
                [
                    "allow-query", "aws4-hmac-sha256-aws-access-key-id",
                    "aws4-hmac-sha256-region", "aws4-hmac-sha256-service",
                    "aws4-hmac-sha256-secret-access-key", "header",
                    "cap1-hmac-sha512-key", "cap1-hmac-sha512-key-id", "method",
                    "timeout-ms", "tls-ca", "tls-cert", "tls-key",
                    "tls-reject-unauthorized", "uri"
                ],
                requiresArg: true,
                type: "string"
            }
        )
        .option("header",
            {
                group,
                describe: `Header to include in requests. (ex: --header "X-My: Header")`,
                conflicts: "capability-to-export",
                coerce: opt =>
                {
                    return opt.map(header => header.split(":").map(part => part.trim()))
                        .map(parts =>
                            {
                                if (parts.length != 2)
                                {
                                    throw new Error(`Failed parsing header "${opt}"`);
                                }
                                if (parts[0].length == 0)
                                {
                                    throw new Error(`Header name must have non-zero length "${opt}"`);
                                }
                                return (
                                    {
                                        name: parts[0],
                                        value: parts[1]
                                    }
                                );
                            }
                        )
                        .reduce((headers, {name, value}) =>
                            {
                                headers[name] = value;
                                return headers;
                            },
                            {}
                        );
                },
                implies: "uri",
                requiresArg: true,
                type: "array"
            }
        )
        .option("aws4-hmac-sha256-aws-access-key-id",
            {
                group,
                describe: "AWS Secret Key Id for AWS4-HMAC-SHA256 signature.",
                conflicts:
                [
                    "capability-to-export", "cap1-hmac-sha512-key",
                    "cap1-hmac-sha512-key-id"
                ],
                implies: "uri",
                requiresArg: true,
                type: "string",
                implies:
                [
                    "aws4-hmac-sha256-region", "aws4-hmac-sha256-service",
                    "aws4-hmac-sha256-secret-access-key"
                ]
            }
        )
        .option("aws4-hmac-sha256-region",
            {
                group,
                describe: "AWS region for AWS4-HMAC-SHA256 signature.",
                conflicts:
                [
                    "capability-to-export", "cap1-hmac-sha512-key",
                    "cap1-hmac-sha512-key-id"
                ],
                implies: "uri",
                requiresArg: true,
                type: "string",
                implies:
                [
                    "aws4-hmac-sha256-aws-access-key-id",
                    "aws4-hmac-sha256-service",
                    "aws4-hmac-sha256-secret-access-key"
                ]
            }
        )
        .option("aws4-hmac-sha256-service",
            {
                group,
                describe: "AWS service for AWS4-HMAC-SHA256 signature.",
                conflicts:
                [
                    "capability-to-export", "cap1-hmac-sha512-key",
                    "cap1-hmac-sha512-key-id"
                ],
                implies: "uri",
                requiresArg: true,
                type: "string",
                implies:
                [
                    "aws4-hmac-sha256-aws-access-key-id",
                    "aws4-hmac-sha256-region",
                    "aws4-hmac-sha256-secret-access-key"
                ]
            }
        )
        .option("aws4-hmac-sha256-secret-access-key",
            {
                group,
                describe: "AWS Secret Access Key for AWS4-HMAC-SHA256 signature.",
                conflicts:
                [
                    "capability-to-export", "cap1-hmac-sha512-key",
                    "cap1-hmac-sha512-key-id"
                ],
                implies: "uri",
                requiresArg: true,
                type: "string",
                implies:
                [
                    "aws4-hmac-sha256-aws-access-key-id",
                    "aws4-hmac-sha256-region", "aws4-hmac-sha256-service"
                ]
            }
        )
        .option("cap1-hmac-sha512-key",
            {
                group,
                describe: "Base64url encoded secret key bytes for CAP1-HMAC-SHA512 signature.",
                conflicts:
                [
                    "aws4-hmac-sha256-aws-access-key-id",
                    "aws4-hmac-sha256-region", "aws4-hmac-sha256-service",
                    "aws4-hmac-sha256-secret-access-key", "capability-to-export"
                ],
                implies: "uri",
                requiresArg: true,
                type: "string",
                implies: "cap1-hmac-sha512-key-id"
            }
        )
        .option("cap1-hmac-sha512-key-id",
            {
                group,
                describe: "Secret key id for CAP1-HMAC-SHA512 signature.",
                conflicts:
                [
                    "aws4-hmac-sha256-aws-access-key-id",
                    "aws4-hmac-sha256-region", "aws4-hmac-sha256-service",
                    "aws4-hmac-sha256-secret-access-key", "capability-to-export"
                ],
                implies: "uri",
                requiresArg: true,
                type: "string",
                implies: "cap1-hmac-sha512-key"
            }
        )
        .option("method",
            {
                group,
                describe: "HTTP method to use in requests.",
                conflicts: "capability-to-export",
                implies: "uri",
                requiresArg: true,
                type: "string"
            }
        )
        .option("timeout-ms",
            {
                group,
                describe: "Timeout in milliseconds to end idle connections.",
                conflicts: "capability-to-export",
                implies: "uri",
                requiresArg: true,
                type: "number"
            }
        )
        .option("tls-ca",
            {
                group,
                describe: "Override default trusted CA to provided CA.",
                conflicts: "capability-to-export",
                implies: "uri",
                requiresArg: true,
                type: "string"
            }
        )
        .option("tls-cert",
            {
                group,
                describe: "Client-side certificate to use when membrane makes a request.",
                conflicts: "capability-to-export",
                implies: "uri",
                requiresArg: true,
                type: "string"
            }
        )
        .option("tls-key",
            {
                group,
                describe: "Client-side certificate private key to use when membrane makes a request.",
                conflicts: "capability-to-export",
                implies: "uri",
                requiresArg: true,
                type: "string"
            }
        )
        .option("tls-reject-unauthorized",
            {
                group,
                describe: `Set to "false" if membrane should not verify server against list of supplied CAs when making a request.`,
                default: undefined,
                conflicts: "capability-to-export",
                implies: "uri",
                type: "boolean"
            }
        )
        .option("uri",
            {
                group,
                describe: "Fully qualified URI.",
                conflicts: "capability-to-export",
                requiresArg: true,
                type: "string"
            }
        );
};

exports.handler = function(args)
{
    const capability = membrane.capability(args, "export");
    const service = new CapabilitySdk.Membrane(
        {
            tls:
            {
                rejectUnauthorized: !args["tls-self-signed"]
            }
        }
    );
    const config =
    {
        capability: args["capability-to-export"],
        uri: args.uri,
        allowQuery: args["allow-query"],
        headers: args.header,
        method: args.method,
        timeoutMs: args["timeout-ms"]
    };
    if (args["cap1-hmac-sha512-key-id"])
    {
        config.hmac =
        {
            "cap1-hmac-sha512":
            {
                key: args["cap1-hmac-sha512-key"],
                keyId: args["cap1-hmac-sha512-key-id"]
            }
        };
    }
    if (args["aws4-hmac-sha256-aws-access-key-id"])
    {
        config.hmac =
        {
            "aws4-hmac-sha256":
            {
                awsAccessKeyId: args["aws4-hmac-sha256-aws-access-key-id"],
                region: args["aws4-hmac-sha256-region"],
                service: args["aws4-hmac-sha256-service"],
                secretAccessKey: args["aws4-hmac-sha256-secret-access-key"]
            }
        };
    }
    const tls =
    {
        ca: args["tls-ca"],
        cert: args["tls-cert"],
        key: args["tls-key"],
        rejectUnauthorized: args["tls-reject-unauthorized"]
    };
    if (Object.values(tls).filter(v => v).length > 0)
    {
        config.tls = tls;
    }
    Object.entries(config).map(([name, value]) => value === undefined ? delete config[name] : undefined);
    service.export(capability, config,
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
