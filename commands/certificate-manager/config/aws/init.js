/*
 * Copyright 2018 Capability LLC. All Rights Reserved.
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

const AWS = require("aws-sdk");
const events = require("events");

exports.command = "init";

exports.desc = "Initialize.";

exports.builder = function(yargs)
{
    const group = "Initialize:";
    return yargs
};

exports.handler = function(args)
{
    const awsCredentials = new AWS.SharedIniFileCredentials(
        {
            profile: args["amzn-profile"]
        }
    );
    AWS.config.credentials = awsCredentials;
    const workflow = new events.EventEmitter();
    setImmediate(() => workflow.emit("start",
        {
        }
    ));
    workflow.on("start", dataBag => workflow.emit("TODO", dataBag));
};
