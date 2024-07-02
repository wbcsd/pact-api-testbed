/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { Validator } from "lupinus";
import { Http } from "./http.js";
import { LogLevel, Logger } from "./logger.js";
import { v4 as UUID } from "uuid";
import { formatToIso8601String } from "./date-utils.js";
import { StubPathfinderServer } from "./stub.js";
import Path from "path";
import { fileURLToPath } from "url";

/**
 * @typedef {object} PathfinderValidatorSetting
 * @property {string} version
 * @property {string} authContextPath
 * @property {string} userName
 * @property {string} password
 * @property {string} dataContextPath
 * @property {boolean} filterSupport
 * @property {boolean} limitSupport
 * @property {boolean} eventsSupport
 * @property {"stdout"|"file"} log
 * @property {boolean} verboseLog
 * @property {string} stubContextPath
 * @property {import("./stub.js").StubFootprint} [stubData]
 */

export class PathfinderValidator {

    /**
     * @param {PathfinderValidatorSetting} setting 
     * @returns {Promise}
     */
    static async validate(setting) {
        let specVersion = setting.version;
        let authContextPath = setting.authContextPath;
        let userName = setting.userName;
        let password = setting.password;
        let dataContextPath = setting.dataContextPath;
        let filterSupport = setting.filterSupport;
        let limitSupport = setting.limitSupport;
        let eventsSupport = setting.eventsSupport;
        let log = setting.log;
        let verboseLog = setting.verboseLog;
        let stubContextPath = setting.stubContextPath;
        let stubData = setting.stubData;

        if(specVersion == null) {
            throw new Error("The specVersion is not specified.");
        }
        if(authContextPath == null) {
            throw new Error("The authContextPath is not specified.");
        }
        if(userName == null) {
            throw new Error("The userName is not specified.");
        }
        if(password == null) {
            throw new Error("The password is not specified.");
        }
        if(dataContextPath == null) {
            throw new Error("The dataContextPath is not specified.");
        }
        if(filterSupport == null) {
            filterSupport = false;
        }
        if(limitSupport == null) {
            limitSupport = false;
        }
        if(eventsSupport == null) {
            eventsSupport = false;
        }
        if(log == null) {
            log = "stdout";
        }
        if(verboseLog == null) {
            verboseLog = false;
        }
        if(stubContextPath == null) {
            stubContextPath = "http://localhost:3000"
        }

        /** @type {import("lupinus/logger").LoggerSetting} */
        let logSetting = {
            threshold: "debug"
        };
        if(log == "file") {
            logSetting.output = "result.log";
            logSetting.errorOutput = "error.log";
        }
        let logger = new Logger(undefined, logSetting);

        let response;

        let authPath = "/auth/token";

        // OpenID Connect Discovery
        response = await Http.request("get", authContextPath + "/.well-known/openid-configuration");
        if(response.status == 200 && response.body != null && response.body.token_endpoint != null) {
            authContextPath = "";
            authPath = response.body.token_endpoint;
        }
        
        let host = new URL(authContextPath+authPath).hostname;

        // Attempt to authenticate with incorrect credentials
        let incorrectUserName = this.randomString(16);
        let incorrectPassword = this.randomString(16);
        response = await Http.request("post", authContextPath + authPath, {
            host: host,
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
            authorization: "Basic " + Buffer.from(incorrectUserName+":"+incorrectPassword).toString("base64")
        }, {
            "grant_type": "client_credentials"
        });
        if(response.status == 200) {
            logger.writeLog(`\u001b[31mNG\u001b[0m Success response was obtained despite incorrect credentials. USERNAME: ${incorrectUserName} PASSWORD: ${incorrectPassword} URL: ${authContextPath + authPath}`);
            return;
        }

        // OAuth 2.0 Clinet Credential Grant
        response = await Http.request("post", authContextPath + authPath, {
            host: host,
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
            authorization: "Basic " + Buffer.from(userName+":"+password).toString("base64")
        }, {
            "grant_type": "client_credentials"
        });
        if(response.status != 200) {
            logger.writeLog(`\u001b[31mNG\u001b[0m Authentication failed. STATUS: ${response.status} URL: ${authContextPath + authPath}`);
            return;
        }
        let accessToken = response.body.access_token;
        if(accessToken == null) {
            logger.writeLog(`\u001b[31mNG\u001b[0m Access token is empty. URL: ${authContextPath + authPath}`);
            return;
        }

        let pathPrefex;
        if(specVersion.startsWith("1")) {
            pathPrefex = "/0";
        }else if(specVersion.startsWith("2")) {
            pathPrefex = "/2";
        }else {
            throw new Error("Invalid specVersion.");
        }

        // Footprints acquisition
        response = await Http.request("get", dataContextPath + pathPrefex + "/footprints", {
            host: host,
            authorization: "Bearer " + accessToken
        });
        if(response.status != 200 && response.status != 202) {
            logger.writeLog(`\u001b[31mNG\u001b[0m Footprints acquisition failed. STATUS: ${response.status} URL: ${dataContextPath + pathPrefex + "/footprints"}`);
            return;
        }
        if(response.body == null) {
            logger.writeLog(`\u001b[31mNG\u001b[0m Action Listfootprints was a successful response, but the data is empty. URL: ${dataContextPath + pathPrefex + "/footprints"}`);
            return;
        }
        /** @type {Array<object>} */
        let footprints = response.body.data;

        let createdVariation;
        let productIdsVariation;

        if(footprints == null || footprints.length == 0) {
            logger.writeLog(`\u001b[31mNG\u001b[0m Action Listfootprints was a successful response, but the data is empty. URL: ${dataContextPath + pathPrefex + "/footprints"}`);
            return;
        }else if(footprints.length == 1) {
            if(filterSupport || limitSupport) {
                logger.writeLog(`\u001b[31mNG\u001b[0m Action Listfootprints was a successful response, but there is only one data set, so it is not possible to test filtering or limitations. URL: ${dataContextPath + pathPrefex + "/footprints"}`);
                return;
            }
        }else {
            createdVariation = footprints.reduce((result, record) => {
                if(!result.includes(record.created)) {
                    result.push(record.created);
                }
                return result;
            }, []);
            productIdsVariation = footprints.reduce((result, record) => {
                if(result.findIndex(entry => entry.every(productId => record.productIds.includes(productId))) == -1) {
                    result.push(record.productIds);
                }
                return result;
            }, []);
            if(filterSupport && createdVariation.length <= 1) {
                logger.writeLog(`\u001b[31mNG\u001b[0m Action Listfootprints was a successful response, but the filtering cannot be tested because there is only one variation of the created. URL: ${dataContextPath + pathPrefex + "/footprints"}`);
                return;
            }else if(filterSupport && productIdsVariation.length <= 1) {
                logger.writeLog(`\u001b[31mNG\u001b[0m Action Listfootprints was a successful response, but the filtering cannot be tested because there is only one variation of the productIds. URL: ${dataContextPath + pathPrefex + "/footprints"}`);
                return;
            }
        }

        /** @type {import("lupinus/testset").TestSet} */
        let testSet = {
            testCases: [
                {
                    title: "Retrieval of all footprints",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken
                                }
                            },
                            response: {
                                status: 200
                            }
                        }
                    ]
                },
                {
                    title: "Date filtering for footprints",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken
                                },
                                body: {
                                    "$filter": `created ge ${createdVariation[0]}`
                                }
                            },
                            response: (filterSupport ? ({
                                status: 200
                            }) : ({
                                status: 400,
                                body: "{code = NotImplemented}"
                            }))
                        }
                    ]
                },
                {
                    title: "Product filtering for footprints",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken
                                },
                                body: {
                                    "$filter": `productIds/any(productId:(productId eq '${productIdsVariation[0]}'))`
                                }
                            },
                            response: (filterSupport ? ({
                                status: 200
                            }) : ({
                                status: 400,
                                body: "{code = NotImplemented}"
                            }))
                        }
                    ]
                },
                {
                    title: "Footprint acquisition limitations",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken
                                },
                                body: {
                                    limit: 1
                                }
                            },
                            response: (limitSupport ? ({
                                status: 200,
                                headers: "{link != null}",
                                body: "{data.length == 1}"
                            }) : ({
                                status: 400,
                                body: "{code = NotImplemented}"
                            }))
                        }
                    ]
                },
                {
                    title: "Retrieve the specific footprint",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints/{PfId}",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken
                                },
                                body: {
                                    PfId: footprints[0].id
                                }
                            },
                            response: {
                                status: 200,
                                body: "{data.id == "+footprints[0].id+"}"
                            }
                        }
                    ]
                },
                {
                    title: "Footprint update notification",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/events",
                            method: "post",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken,
                                    "content-type": "application/cloudevents+json; charset=UTF-8"
                                },
                                body: {
                                    type: "org.wbcsd.pathfinder.ProductFootprint.Published.v1",
                                    specversion: "1.0",
                                    id: UUID(),
                                    source: stubContextPath + pathPrefex + "/events",
                                    time: formatToIso8601String(new Date(), true),
                                    data: {
                                        pfIds: [UUID()]
                                    }
                                }
                            },
                            response: (eventsSupport ? ({
                                status: 200
                            }) : ({
                                status: 400,
                                body: "{code = NotImplemented}"
                            }))
                        }
                    ]
                },
                {
                    title: "Request to send footprints",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/events",
                            method: "post",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken,
                                    "content-type": "application/cloudevents+json; charset=UTF-8"
                                },
                                body: {
                                    type: "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1",
                                    specversion: "1.0",
                                    id: UUID(),
                                    source: stubContextPath + pathPrefex + "/events",
                                    time: formatToIso8601String(new Date(), true),
                                    data: {
                                        pf: {
                                            companyIds: footprints[0].companyIds,
                                            productIds: footprints[0].productIds
                                        },
                                        comment: "Please send PCF data for this year."
                                    }
                                }
                            },
                            response: (eventsSupport ? ({
                                status: 200
                            }) : ({
                                status: 400,
                                body: "{code = NotImplemented}"
                            }))
                        }
                    ]
                },
                {
                    title: "Illegal access token",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + this.randomString(32)
                                }
                            },
                            response: {
                                status: 403,
                                body: "{code = AccessDenied}"
                            }
                        }
                    ]
                },
                {
                    title: "Incorrect specific footprint request",
                    contextPath: dataContextPath,
                    sequence: [
                        {
                            path: pathPrefex + "/footprints/{PfId}",
                            method: "get",
                            request: {
                                headers: {
                                    host: host,
                                    authorization: "Bearer " + accessToken
                                },
                                body: {
                                    PfId: UUID()
                                }
                            },
                            response: {
                                status: 404,
                                body: "{code = NoSuchFootprint}"
                            }
                        }
                    ]
                }
            ]
        };

        function specFilePath(specVersion) {
            return Path.join(Path.dirname(fileURLToPath(import.meta.url)), "spec", "pathfinder-"+specVersion+".yaml");
        }

        if(eventsSupport) {
            let stubServer = new StubPathfinderServer({
                contextPath: stubContextPath,
                destinationServer: {
                    authContextPath: authContextPath,
                    authPath: authPath,
                    userName: userName,
                    password: password,
                    dataContextPath: dataContextPath,
                    pathPrefex: pathPrefex
                },
                data: stubData,
                logSetting: logSetting
            });
            stubServer.on("data", requestBody => {
                if(requestBody.type == "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1") {
                    let footprints = requestBody.data.pfs;
                    let validator = new Validator(specFilePath(specVersion));
                    let schema = validator.getComponent("#/components/schemas/ProductFootprint");
                    if(schema == null) {
                        throw new Error("Components could not be read.");
                    }
                    footprints.forEach(footprint => {
                        try {
                            validator.validateJson(footprint, schema);
                        }catch(error) {
                            logger.writeLog(`\u001b[31mNG\u001b[0m ${error.message}`);
                            logger.writeLog(error.stack, LogLevel.debug);
                        }
                    });
                }
            });
            stubServer.on("error", error => {
                logger.writeLog(`\u001b[31mNG\u001b[0m ${error.message}`);
                logger.writeLog(error.stack, LogLevel.debug);
            });
        }

        let validator = new Validator(specFilePath(specVersion), testSet, logSetting, verboseLog);
        await validator.validate();
    }

    /**
     * @param {number} length 
     * @returns {string}
     */
    static randomString(length) {
        let variation = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let string = "";
        for(let i=0; i<length; i++) {
            string += variation[Math.floor(Math.random()*variation.length)];
        }
        return string;
    }
}