#!/usr/bin/env node

/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import Inquirer from "inquirer";
import { readFileSync } from "fs";
import { PathfinderValidator } from "./validator.js";
import YAML from "js-yaml";
import { loadTextResource, getFileList } from "./github.js";

const WBCSD_PACT_OPENAPI_URL = "https://raw.githubusercontent.com/wbcsd/pact-openapi/main/";

let settingFilePath;

for (let i=2; i<process.argv.length; i++) {
    let arg = process.argv[i];
    if (arg === "--setting") {
        i++;
        if (i >= process.argv.length) {
            throw new Error("Expecting file name after --setting."); 
        }
        settingFilePath = process.argv[i];
    }
}

let setting;

if (settingFilePath != null)
{
    if(settingFilePath.endsWith(".json")) {
        setting = JSON.parse(readFileSync(settingFilePath, "utf8"));
    }else if(settingFilePath.endsWith(".yaml")) {
        setting = YAML.load(readFileSync(settingFilePath, "utf8"));
    }
    if(setting == null) {
        console.error("The setting argument is invalid.");
        process.exit(1);
    }
} else
{
    let specs = await getFileList("wbcsd", "pact-openapi")
    if (specs.length == 0) {
        console.error(`None of the valid specification files could be loaded, please contact PACT.`);
        process.exit(1);
    }
    let versions = specs
            .map(spec => spec.substring("pact-openapi-".length, spec.lastIndexOf(".")))
            .sort((ver1, ver2) => ver1 < ver2 ? 1 : (ver1 > ver2 ? -1 : 0));
    setting = await Inquirer.prompt([
        {
            name: "version",
            message: "Pathfinder version",
            type: "list", 
            choices: versions
        },
        {
            name: "authContextPath",
            message: "Authentication context path\nTypically, the endpoint is this context path plus /auth/token. \ne.g. https://example.com/auth\n",
            type: "input", 
            validate: answer => {
                if(/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/.test(answer)) {
                    return true;
                }else {
                    return "Please enter a URL string.";
                }
            }
        },
        {
            name: "userName",
            message: "Username for Action Authenticate",
            type: "input"
        },
        {
            name: "password",
            message: "Password for Action Authenticate",
            type: "password"
        },
        {
            name: "dataContextPath",
            message: "Data context path\nIn Tech Spec ver2, the endpoint is this context path with /2/footprints appended to it.\ne.g. https://example.com/app\n",
            type: "input", 
            validate: answer => {
                if(/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/.test(answer)) {
                    return true;
                }else {
                    return "Please enter a URL string.";
                }
            }
        },
        {
            name: "filterSupport",
            message: "Does the system support the $filter request parameter in Action ListFootprints?",
            type: "confirm",
            default: true
        },
        {
            name: "limitSupport",
            message: "Does the system support the limit request parameter in Action ListFootprints?",
            type: "confirm",
            default: true
        },
        {
            name: "eventsSupport",
            message: "Does the system support Action Events?",
            type: "confirm",
            default: true
        },
        {
            name: "log",
            message: "Where do you want the logs output to?",
            type: "list",
            choices: ["stdout", "file"]
        },
        {
            name: "verboseLog",
            message: "Do you want detailed log output? (e.g. response content)",
            type: "confirm",
            default: false
        },
        {
            name: "stubContextPath",
            message: "Enter the context path of the stub server.\nThe stub server is required for testing asynchronous responses from the test app in Action Events.\nSet this URL to the test app as necessary.\n",
            type: "input",
            default: "http://localhost:3000"
        },
        {
            name: "keepStub",
            message: "Do you want to keep the stub server running?\nEnable this if you want to verify asynchronous responses to Action Events from your test target.",
            type: "confirm",
            default: true
        },
        {
            name: "stubDataEnabled",
            message: "Do you want to set the content of the data returned by the stub server?",
            type: "confirm",
            default: false
        },
        {
            name: "stubData.companyIds",
            message: "The company identifier included in the data when the stub server responds to Action GetFootprint/ListFootprints.\n",
            type: "input",
            when: answer => answer.stubDataEnabled
        },
        {
            name: "stubData.productIds",
            message: "The product identifier included in the data when the stub server responds to Action GetFootprint/ListFootprints.\n",
            type: "input",
            when: answer => answer.stubDataEnabled
        }
    ]);
    delete setting.stubDataEnabled;
    if(setting.stubData != null) {
        if(setting.stubData.companyIds != null && setting.stubData.companyIds.length > 0) {
            setting.stubData.companyIds = [setting.stubData.companyIds];
        }else {
            delete setting.stubData.companyIds;
        }
        if(setting.stubData.productIds != null && setting.stubData.productIds.length > 0) {
            setting.stubData.productIds = [setting.stubData.productIds];
        }else {
            delete setting.stubData.productIds;
        }
    }
}

if ((setting.url != null && setting.version != null) ||
    (setting.url == null && setting.version == null)) {
    throw new Error("Provide either the specification URL or a version.");
}
if (setting.url == null) {
    setting.url = `${WBCSD_PACT_OPENAPI_URL}pact-openapi-${setting.version}.yaml`;
} 

// Load the OpenAPI specification
setting.spec = YAML.load(await loadTextResource(setting.url));

try {
    await PathfinderValidator.validate(setting);
    if(setting.keepStub == undefined || !setting.keepStub) {
        process.exit(0);
    }else {
        console.log("Control+C to exit.");

    }
}catch(error) {
    console.error(error.message, error.stack);
    process.exit(1);
}