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

const CapabilityUri = require("capability-uri");
const fs = require("fs");
const os = require("os");
const path = require("path");
const regions = require("../regions.js");
const services = require("../services.js");
const yaml = require("js-yaml");

const command = "config <command>";

const desc = "Capability CLI (capi) configuration."

const builder = function(yargs)
{
    ensureCapabilityDirExists();
    const group = "Config:";
    return yargs.commandDir("config")
        .demandCommand()
        .option("profile",
            {
                group,
                describe: "Capability profile to use.",
                default: "default",
                requiresArg: true,
                type: "string"
            }
        )
;
};

const handler = function(args) {};

const CAPI_DIRECTORY_PATH = path.normalize(path.join(os.homedir(), ".capability"));
const CAPI_CONFIG_PATH = path.normalize(path.join(CAPI_DIRECTORY_PATH, "config"));
const CAPI_CREDENTIALS_PATH = path.normalize(path.join(CAPI_DIRECTORY_PATH, "credentials"));

const CONFIG_PATTERNS =
{
    region: new RegExp(`^\\s*(${regions.join("|")})\\s*$`)
};
const CONFIG_PROPERTIES =
[
    "region"
];
const SERVICE_CAPABILITIES =
{
    membrane:
    [
        "create", "deleteSelf", "query"
    ]
};

const ensureCapabilityDirExists = () =>
{
    try
    {
        fs.statSync(CAPI_DIRECTORY_PATH);
    }
    catch (error)
    {
        fs.mkdirSync(CAPI_DIRECTORY_PATH, 0o700);
    }
};

const loadConfig = () => loadYaml(CAPI_CONFIG_PATH);
const loadCredentials = () => loadYaml(CAPI_CREDENTIALS_PATH);

const loadYaml = path =>
{
    try
    {
        const stat = fs.statSync(path);
        if (stat.isFile())
        {
            const obj = {};
            yaml.safeLoadAll(
                fs.readFileSync(path, "utf8"),
                doc =>
                {
                    if (doc.profile)
                    {
                        obj[doc.profile] = doc;
                    }
                }
            );
            return obj;
        }
    }
    catch (error)
    {
        return undefined;
    }
};

const capabilityExists = (obj, profile, service, name) =>
{
    return (obj !== undefined
            && obj[profile] !== undefined
            && obj[profile][service] !== undefined
            && obj[profile][service].capabilities !== undefined
            && obj[profile][service].capabilities[name] !== undefined);
};

const propertyExists = (obj, profile, service, property) =>
{
    return (obj !== undefined
            && obj[profile] !== undefined
            && obj[profile][service] !== undefined
            && obj[profile][service][property] !== undefined);
};

const saveConfig = newConfig =>
{
    fs.writeFileSync(
        CAPI_CONFIG_PATH,
        Object.keys(newConfig)
            .map(profile => yaml.safeDump(newConfig[profile]))
            .join("---\n"),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );
};

const saveCredentials = newCredentials =>
{
    fs.writeFileSync(
        CAPI_CREDENTIALS_PATH,
        Object.keys(newCredentials)
            .map(profile => yaml.safeDump(newCredentials[profile]))
            .join("---\n"),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );
}

const secretPreview = (credentials, profile, service, name) =>
{
    if (profile === undefined && service === undefined && name === undefined)
    {
        const secret = credentials;
        if (!secret)
        {
            return "(none)";
        }
        return _secretPreview(secret);
    }
    if (!capabilityExists(credentials, profile, service, name))
    {
        return "(none)";
    }
    return _secretPreview(credentials[profile][service].capabilities[name]);
};

const _secretPreview = secret =>
{
    const capabilityUri = CapabilityUri.parse(secret);
    return `(...${capabilityUri.capabilityToken.serialize().slice(-5)})`;
};

exports = Object.assign(exports,
    {
        command,
        desc,
        builder,
        handler,
        CAPI_CONFIG_PATH,
        CAPI_CREDENTIALS_PATH,
        CAPI_DIRECTORY_PATH,
        CONFIG_PATTERNS,
        CONFIG_PROPERTIES,
        capabilityExists,
        ensureCapabilityDirExists,
        loadConfig,
        loadCredentials,
        propertyExists,
        saveConfig,
        saveCredentials,
        secretPreview,
        SERVICE_CAPABILITIES
    }
);
