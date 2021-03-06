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

const config = require("./config.js");

exports.command = "profiles";

exports.desc = "List profiles.";

exports.builder = function(yargs)
{
    return yargs;
};

exports.handler = function(args)
{
    const savedConfig = config.loadConfig() || {};
    const savedCredentials = config.loadCredentials() || {};
    Object.keys(
        Object.keys(savedConfig)
            .concat(Object.keys(savedCredentials))
            .reduce((profiles, profile) =>
                {
                    profiles[profile] = true;
                    return profiles;
                },
                {}
            )
    )
    .map(profile => console.log(profile));
};
