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

exports.command = "getverificationstatus";

exports.desc = "Get verification status.";

exports.builder = function(yargs)
{
    const group = "Get verification status:";
    return yargs;
};

exports.handler = function(args)
{
    const capability = media.capability(args, "getVerificationStatus");
    const service = new CapabilitySDK.Media(
        {
            tls:
            {
                trustedCA: args["trustedCA-file-path"]
            }
        }
    );
    service.getVerificationStatus(capability, (error, resp) =>
        {
            if (error)
            {
                return media.error(error);
            }
            console.log(JSON.stringify(resp, null, 2));
        }
    );
};
