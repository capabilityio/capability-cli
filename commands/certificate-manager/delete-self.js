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
const certificateManager = require("../certificate-manager.js");

exports.command = "delete-self";

exports.desc = "Delete self.";

exports.builder = function(yargs)
{
    return yargs;
};

exports.handler = function(args)
{
    const capability = certificateManager.capability(args, "deleteSelf");
    const service = new CapabilitySDK.CertificateManager(
        {
            tls:
            {
                trustedCA: args["trustedCA-file-path"]
            }
        }
    );
    service.deleteSelf(capability, (error, resp) =>
        {
            if (error)
            {
                return certificateManager.error(error);
            }
            console.log(JSON.stringify(resp, null, 2));
        }
    );
};
