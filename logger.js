/*!
 * Copyright 2017 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { readFileSync, appendFile } from "fs";
import YAML from "js-yaml";

export const LogLevel = {
    debug: 1,
    info: 2,
    warning: 3,
    error: 4,
    critical: 5
};

/**
 * @typedef {object} LoggerSetting
 * @property {"debug"|"info"|"warning"|"error"|"critical"} [threshold]
 * @property {string} [output]
 * @property {string} [errorOutput]
 */

export class Logger {

    #threshold = 2;

    #output;
    #errorOutput;

    /**
     * @param {string} [caller] 
     * @param {string|LoggerSetting} [setting]
     */
    constructor(caller, setting) {
        /** @type {object} */
        let _setting;
        if(setting != null) {
            if(typeof setting == "string") {
                if(setting.endsWith(".json")) {
                    _setting = JSON.parse(readFileSync(setting, "utf8"));
                }else if(setting.endsWith(".yaml") || setting.endsWith(".yml")) {
                    _setting = /** @type {object} */(YAML.load(readFileSync(setting, "utf8")));
                }
            }else {
                _setting = setting;
            }
        }
        if(_setting == null) {
            _setting = {
                threshold: "debug"
            };
        }
        if(caller != null && _setting[caller] != null) {
            let __settings = _setting[caller];
            Object.keys(__settings).forEach(key => {
                _setting[key] = __settings[key];
            });
        }

        if(_setting.threshold != null && typeof _setting.threshold == "string") {
            if(_setting.threshold == "debug") {
                this.#threshold = LogLevel.debug;
            }else if(_setting.threshold == "info") {
                this.#threshold = LogLevel.info;
            }else if(_setting.threshold == "warning") {
                this.#threshold = LogLevel.warning;
            }else if(_setting.threshold == "error") {
                this.#threshold = LogLevel.error;
            }else if(_setting.threshold == "critical") {
                this.#threshold = LogLevel.critical;
            }
        }

        if(_setting.output != null && typeof _setting.output == "string") {
            this.#output = _setting.output;
        }
        if(_setting.errorOutput != null && typeof _setting.errorOutput == "string") {
            this.#errorOutput = _setting.errorOutput;
        }
    }

    writeLog(message, logLevel, force) {
        if(logLevel == undefined) {
            logLevel = 2;
        }
        if((force == undefined || !force) && logLevel < this.#threshold) {
            return;
        }
        message = this.dateString() + " " + message + "\n";
        if(this.#output !== undefined) {
            message = message.replaceAll(/\u001b\[[0-9]{1,2}m/g, "");
            appendFile(this.#output, message, function(){});
        }else {
            process.stdout.write(message);
        }
    }
    
    writeError(message, logLevel, force) {
        if(logLevel == undefined) {
            logLevel = 4;
        }
        if((force == undefined || !force) && logLevel < this.#threshold) {
            return;
        }
        message = this.dateString() + " " + message + "\n";
        if(this.#errorOutput !== undefined) {
            message = message.replaceAll(/\u001b\[[0-9]{1,2}m/g, "");
            appendFile(this.#errorOutput, message, function(){});
        }else {
            process.stderr.write(message);
        }
    }

    dateString() {
        let date = new Date();
        return date.getFullYear() + "/" + 
            ("00"+(date.getMonth()+1)).slice(-2) + "/" + 
            ("00"+date.getDate()).slice(-2) + " " + 
            ("00"+date.getHours()).slice(-2) + ":" + 
            ("00"+date.getMinutes()).slice(-2) + ":" + 
            ("00"+date.getSeconds()).slice(-2) + ":" + 
            ("000"+date.getMilliseconds()).slice(-3)
    }
}