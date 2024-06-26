#!/usr/bin/env node

/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import Inquirer from "inquirer";
import { readFileSync, readdirSync } from "fs";
import { PathfinderValidator } from "./validator.js";
import YAML from "js-yaml";
import Path from "path";
import { fileURLToPath } from "url";

let specs = readdirSync(Path.join(Path.dirname(fileURLToPath(import.meta.url)), "spec"));
let versions = specs
    .map(spec => spec.substring("pathfinder-".length, spec.lastIndexOf(".")))
    .sort((ver1, ver2) => ver1 < ver2 ? 1 : (ver1 > ver2 ? -1 : 0));

let settingFile;

if(process.argv.length > 2) {
    let args = process.argv;
    for(let i=2; i<args.length; i++) {
        let argument = args[i];
        if(argument.startsWith("--") && argument.length > 1) {
            let key = argument.substring(2);
            let value;
            if(i<args.length-1) {
                value = args[i+1];
                i++;
            }
            if(value == null) continue;
            if(key == "setting") {
                settingFile = value;
            }
        }
    }
}

if(settingFile != null) {
    let setting;
    if(settingFile.endsWith(".json")) {
        setting = JSON.parse(readFileSync(settingFile, "utf8"));
    }else if(settingFile.endsWith(".yaml")) {
        setting = YAML.load(readFileSync(settingFile, "utf8"));
    }
    if(setting == null) {
        console.error("The setting argument is invalid.");
        process.exit(1);
    }
    PathfinderValidator.validate(setting).then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(error.message, error.stack);
        process.exit(1);
    });
}else {
    Inquirer.prompt([
        {
            name: "version",
            message: "Pathfinder version",
            type: "list", 
            choices: versions
        },
        {
            name: "authContextPath",
            message: "Authentication context path (e.g. https://example.com/auth)",
            type: "input", 
            validate: answer => /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(answer)
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
            message: "Data context path (e.g. https://example.com/data)",
            type: "input", 
            validate: answer => /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(answer)
        },
        {
            name: "filterSupport",
            message: "Does the system support the $filter request parameter in Action ListFootprints?",
            type: "confirm"
        },
        {
            name: "limitSupport",
            message: "Does the system support the limit request parameter in Action ListFootprints?",
            type: "confirm"
        },
        {
            name: "eventsSupport",
            message: "Does the system support Action Events?",
            type: "confirm"
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
            type: "confirm"
        },
        {
            name: "stubContextPath",
            message: "Enter the context path of the stub server.",
            type: "input",
            default: "http://localhost:3000"
        }
    ]).then(setting => {
        PathfinderValidator.validate(setting).then(() => {
            process.exit(0);
        }).catch(error => {
            console.error(error.message, error.stack);
            process.exit(1);
        });
    });
}