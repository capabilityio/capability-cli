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

exports.command = "send-email";

exports.desc = "Send email.";

exports.builder = function(yargs)
{
    const group = "Send email:";
    return yargs
        .option("body-html-charset",
            {
                group,
                describe: "The character set of the HTML content.",
                implies: "body-html-data",
                requiresArg: true,
                type: "string"
            }
        )
        .option("body-html-data",
            {
                group,
                describe: "The actual content of the message, in HTML format.",
                requiresArg: true,
                type: "string"
            }
        )
        .option("body-text-charset",
            {
                group,
                describe: "The character set of the text content.",
                implies: "body-text-data",
                requiresArg: true,
                type: "string"
            }
        )
        .option("body-text-data",
            {
                group,
                describe: "The actual content of the message, in text format.",
                requiresArg: true,
                type: "string"
            }
        )
        .option("subject-charset",
            {
                group,
                describe: "The character set of the subject.",
                implies: "subject-data",
                requiresArg: true,
                type: "string"
            }
        )
        .option("subject-data",
            {
                group,
                describe: "The actual content of the subject.",
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        )
        .option("reply-to-addresses",
            {
                group,
                describe: "The reply-to email address(es) for the message.",
                array: true,
                requiresArg: true,
                type: "string"
            }
        )
        .option("return-path",
            {
                group,
                describe: "The email address that bounces and complaints will be forwarded to when feedback forwarding is enabled.",
                requiresArg: true,
                type: "string"
            }
        )
        .option("source",
            {
                group,
                describe: "The email address that is sending the email.",
                demandOption: true,
                requiresArg: true,
                type: "string"
            }
        );
};

exports.handler = function(args)
{
    const capability = media.capability(args, "sendEmail");
    const service = new CapabilitySDK.Media(
        {
            tls:
            {
                trustedCA: args["trustedCA-file-path"]
            }
        }
    );
    if (!args["body-text-data"] && !args["body-html-data"])
    {
        throw new Error("Need to specify one of: body-html-data, body-text-data");
    }
    const config =
    {
        message:
        {
            body:
            {
                html:
                {
                    charset: args["body-html-charset"],
                    data: args["body-html-data"]
                },
                text:
                {
                    charset: args["body-text-charset"],
                    data: args["body-text-data"]
                }
            },
            subject:
            {
                charset: args["subject-charset"],
                data: args["subject-data"]
            }
        },
        replyToAddresses: args["reply-to-addresses"],
        returnPath: args["return-path"],
        source: args.source
    };
    Object.keys(config).map(key => config[key] === undefined ? delete config[key] : undefined);
    if (!config.message.body.html.data)
    {
        delete config.message.body.html;
    }
    else if (!config.message.body.html.charset)
    {
        delete config.message.body.html.charset;
    }
    if (!config.message.body.text.data)
    {
        delete config.message.body.text;
    }
    else if (!config.message.body.text.charset)
    {
        delete config.message.body.text.charset;
    }
    if (!config.message.subject.charset)
    {
        delete config.message.subject.charset;
    }
    service.sendEmail(capability, config, (error, resp) =>
        {
            if (error)
            {
                return media.error(error);
            }
            console.log(JSON.stringify(resp, null, 2));
        }
    );
};
