/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import Http from "http";
import { v4 as UUID } from "uuid";
import { createHmac } from "crypto";
import { formatToIso8601String } from "./date-utils.js";
import { Http as HttpClient } from "./http.js";
import { Logger } from "./logger.js";
import { EventEmitter } from "events";

/**
 * @typedef {object} StubPathfinderServerSetting
 * @property {string} contextPath
 * @property {DestinationServer} destinationServer
 * @property {import("./logger.js").LoggerSetting} logSetting
 * @property {StubFootprint} [data]
 */

/**
 * @typedef {object} DestinationServer
 * @property {string} authContextPath
 * @property {string} authPath
 * @property {string} userName
 * @property {string} password
 * @property {string} dataContextPath
 * @property {string} pathPrefex
 */

/**
 * @typedef {object} StubFootprint
 * @property {string} [id]
 * @property {Array<string>} [companyIds]
 * @property {Array<string>} [productIds]
 */

const SECRET = "GrSRLR3p";

export class StubPathfinderServer extends EventEmitter {

    /** @type {string} */
    #contextPath;

    /** @type {DestinationServer} */
    #destinationServer;

    /** @type {StubFootprint|undefined} */
    #data

    /** @type {Logger} */
    #logger

    /**
     * @param {StubPathfinderServerSetting} setting 
     */
    constructor(setting) {
        super();

        this.#contextPath = setting.contextPath;
        this.#destinationServer = setting.destinationServer;
        let port = new URL(this.#contextPath).port;

        this.#data = setting.data;

        this.#logger = new Logger(undefined, setting.logSetting);

        const server = Http.createServer((request, response) => {
            this.#logger.writeLog(`Stub server received request ${request.method} ${request.url}.`);
            if(request.url == null) {
                this.handleNotFoundError(response);
                return;
            }
            if(request.url == "/auth/token") {
                this.handleAuthenticate(request, response).catch(error => {
                    this.handleUnauthorizedError(response, error.message);
                    this.emit("error", error);
                });
            }else if(request.url.startsWith("/2/footprints")) {
                try {
                    this.handleAuthorization(request);
                }catch(error) {
                    this.handleForbiddenError(response, error.message);
                    this.emit("error", error);
                    return;
                }
                try {
                    this.handleProductFootprints(request, response);
                }catch(error) {
                    this.handleBadRequestError(response, error.message);
                    this.emit("error", error);
                }
            }else if(request.url == "/2/events") {
                try {
                    this.handleAuthorization(request);
                }catch(error) {
                    this.handleForbiddenError(response, error.message);
                    this.emit("error", error);
                    return;
                }
                this.handleEvents(request, response).then(requestBody => {
                    this.emit("data", requestBody);
                }).catch(error => {
                    this.handleBadRequestError(response, error.message);
                    this.emit("error", error);
                });
            }else {
                this.handleNotFoundError(response);
                return;
            }
        });
        server.on("listening", () => {
            this.#logger.writeLog(`StubPathfinderServer is listening on ${port}.`);
        });
        server.listen(port);
    }

    /**
     * @param {Http.IncomingMessage} request 
     * @param {Http.ServerResponse} response 
     * @returns {Promise<object>}
     */
    async handleAuthenticate(request, response) {
        let authorization = request.headers.authorization;
        if(authorization == null) {
            throw new Error("The authorization header of the request is empty.");
        }
        if(!authorization.startsWith("Basic ")) {
            throw new Error(`The authorization header of the request is invalid. ${authorization}`);
        }
        authorization = authorization.substring("Basic ".length).trim();
        let credentials = Buffer.from(authorization, "base64").toString("utf8").split(":");
        if(credentials.length != 2) {
            throw new Error(`The authorization header of the request is invalid. ${authorization}`);
        }
        await this.retrieveRequest(request);
        let responseBody = {token_type: "Bearer", access_token: this.generateJwtToken()};
        this.handleJson(response, responseBody);
    }

    /**
     * @param {Http.IncomingMessage} request 
     */
    handleAuthorization(request) {
        let authorization = request.headers.authorization;
        if(authorization == null) {
            throw new Error("The authorization header of the request is empty.");
        }
        if(!authorization.startsWith("Bearer ")) {
            throw new Error(`The authorization header of the request is invalid. ${authorization}`);
        }
        authorization = authorization.substring("Bearer ".length).trim();
        this.verifyJwtToken(authorization);
    }

    /**
     * @param {Http.IncomingMessage} request 
     * @param {Http.ServerResponse} response 
     */
    handleProductFootprints(request, response) {
        if(request.url == null) throw new Error("URL cannot be interpreted.");
        if(/.+\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(request.url)) {
            let pfId = request.url.substring(request.url.lastIndexOf("/")+1);
            let responseBody = {data: this.generateFootprint(pfId)};
            this.handleJson(response, responseBody);
        }else {
            let responseBody = {data: [this.generateFootprint()]};
            this.handleJson(response, responseBody);
        }
    }

    /**
     * @param {Http.IncomingMessage} request 
     * @param {Http.ServerResponse} response 
     * @returns {Promise<object>}
     */
    async handleEvents(request, response) {
        let requestBody = await this.retrieveRequest(request);
        
        if(requestBody == null || typeof requestBody != "object") {
            throw new Error("Invalid request.");
        }
        if(request.headers["content-type"] == null) {
            throw new Error("Invalid request.");
        }else if(!request.headers["content-type"].startsWith("application/cloudevents+json")) {
            throw new Error("The Content-Type of the request is invalid.");
        }
        if(requestBody.type == null) {
            throw new Error("The type of the request is invalid.");
        }
        if(requestBody.type != "org.wbcsd.pathfinder.ProductFootprint.Published.v1" && 
            requestBody.type != "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1" &&
            requestBody.type != "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1"&&
            requestBody.type != "org.wbcsd.pathfinder.ProductFootprintRequest.Rejected.v1"
        ) {
            throw new Error("The value of the type property is invalid.");
        }
        if(requestBody.id == null) {
            throw new Error("The id of the request is invalid.");
        }
        if(requestBody.source == null) {
            throw new Error("The source of the request is invalid.");
        }

        this.#logger.writeLog(`REQUEST: \n${JSON.stringify(requestBody, null, 4)}.`);

        if(requestBody.type == "org.wbcsd.pathfinder.ProductFootprint.Published.v1") {
            this.handleSuccess(response);
        }else if(requestBody.type == "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1") {
            let eventId = requestBody.id;
            let data = requestBody.data;

            if(eventId == null) {
                throw new Error("The request body does not contain the id.");
            }else if(data == null) {
                throw new Error("The request body does not contain the data.");
            }

            let fragment = data.pf;

            if(fragment == null) {
                throw new Error("The request body does not contain the data.pf.");
            }
            
            this.handleSuccess(response);

            let host = new URL(this.#contextPath).hostname;

            let authContextPath = this.#destinationServer.authContextPath;
            let authPath = this.#destinationServer.authPath;
            let userName = this.#destinationServer.userName;
            let password = this.#destinationServer.password;
            let dataContextPath = this.#destinationServer.dataContextPath;
            let pathPrefex = this.#destinationServer.pathPrefex;

            let _response;
            _response = await HttpClient.request("post", authContextPath + authPath, {
                host: host,
                accept: "application/json",
                "content-type": "application/x-www-form-urlencoded",
                "authorization": "Basic " + Buffer.from(userName+":"+password).toString("base64")
            }, {
                grant_type: "client_credentials"
            });
            let accessToken;
            if(_response.status == 200) {
                accessToken = _response.body.access_token;
            }
            if(accessToken == null) {
                throw new Error("Authentication error");
            }
            let footprint = this.generateFootprint();
            Object.keys(fragment).forEach(key => {
                footprint[key] = fragment[key];
            });
            _response = await HttpClient.request("post", dataContextPath + pathPrefex + "/events", {
                host: host,
                "content-type": "application/cloudevents+json; charset=UTF-8",
                "authorization": "Bearer " + accessToken
            }, {
                type: "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1",
                specversion: "1.0",
                id: UUID(),
                source: this.#contextPath + "/2/events",
                data: {
                    requestEventId: eventId,
                    pfs: [footprint]
                }
            });
            if(_response.status != 200) {
                let responseBody;
                if(_response.body instanceof Buffer) {
                    responseBody = _response.body.toString("utf8");
                }else if(typeof _response.body == "object") {
                    responseBody = JSON.stringify(_response.body);
                }else {
                    responseBody = _response.body;
                }
                throw new Error(`An error was returned in response to a request to send footprints. STATUS: ${_response.status} BODY: ${responseBody}`);
            }
        }else if(requestBody.type == "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1") {
            let data = requestBody.data;

            if(data == null) {
                throw new Error("The request body does not contain the data.");
            }

            let eventId = data.requestEventId;
            let footprints = data.pfs;

            if(eventId == null) {
                throw new Error("The request body does not contain the data.requestEventId.");
            }
            if(footprints == null) {
                throw new Error("The request body does not contain the data.pfs.");
            }
            if(footprints.length == 0) {
                throw new Error("The data.pfs in the request is empty.");
            }
            
            this.handleSuccess(response);
        }else if(requestBody.type == "org.wbcsd.pathfinder.ProductFootprintRequest.Rejected.v1") {
            let data = requestBody.data;

            if(data == null) {
                throw new Error("The request body does not contain the data.");
            }

            let eventId = data.requestEventId;
            let error = data.error;

            if(eventId == null) {
                throw new Error("The request body does not contain the data.requestEventId.");
            }
            if(error == null) {
                throw new Error("The request body does not contain the data.error.");
            }

            if(error.code == null || error.message == null) {
                throw new Error("The data.error is invalid.");
            }
            if(error.code != "AccessDenied" && 
                error.code != "BadRequest" && 
                error.code != "NoSuchFootprint" && 
                error.code != "NotImplemented" && 
                error.code != "TokenExpired" && 
                error.code != "InternalError") {
                throw new Error("The data.error is invalid.");
            }

            this.handleSuccess(response);
        }
        return requestBody;
    }

    /**
     * @param {Http.ServerResponse} response 
     */
    handleSuccess(response) {
        this.#logger.writeLog(`The stub server returned a success response.`);
        response.writeHead(200);
        response.write("OK");
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     * @param {object} responseBody
     */
    handleJson(response, responseBody) {
        this.#logger.writeLog(`The stub server returned a success response.\nRESPONSE:\n${JSON.stringify(responseBody, null, 4)}`);
        responseBody = JSON.stringify(responseBody); 
        response.writeHead(200, {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     * @param {Error} error 
     */
    handleInternalServerError(response, error) {
        /** @type {object|string} */
        let responseBody = {
            code: "InternalError",
            message: error.message
        };
        this.#logger.writeLog(`The stub server returned an error response.\nRESPONSE:\n${JSON.stringify(responseBody, null, 4)}`);
        responseBody = JSON.stringify(responseBody);
        response.writeHead(500, {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     */
    handleNotFoundError(response) {
        let responseBody = "Not Found";
        this.#logger.writeLog(`The stub server returned an error response.\nRESPONSE:\n${responseBody}`);
        response.writeHead(404, {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     * @param {string} message
     */
    handleBadRequestError(response, message) {
        /** @type {object|string} */
        let responseBody = {
            code: "BadRequest",
            message: message
        };
        this.#logger.writeLog(`The stub server returned an error response.\nRESPONSE:\n${JSON.stringify(responseBody, null, 4)}`);
        responseBody = JSON.stringify(responseBody);
        response.writeHead(400, {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     * @param {string} message
     */
    handleForbiddenError(response, message) {
        /** @type {object|string} */
        let responseBody = {
            code: "AccessDenied",
            message: message
        };
        this.#logger.writeLog(`The stub server returned an error response.\nRESPONSE:\n${JSON.stringify(responseBody, null, 4)}`);
        responseBody = JSON.stringify(responseBody);
        response.writeHead(403, {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     * @param {string} message
     */
    handleUnauthorizedError(response, message) {
        let responseBody = message;
        this.#logger.writeLog(`The stub server returned an error response.\nRESPONSE:\n${responseBody}`);
        response.writeHead(401, {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.ServerResponse} response 
     * @param {string} message
     */
    handleTokenExpiredError(response, message) {
        /** @type {object|string} */
        let responseBody = {
            code: "TokenExpired",
            message: message
        };
        this.#logger.writeLog(`The stub server returned an error response.\nRESPONSE:\n${JSON.stringify(responseBody, null, 4)}`);
        responseBody = JSON.stringify(responseBody);
        response.writeHead(401, {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(responseBody, "utf8")
        });
        response.write(responseBody);
        response.end();
    }

    /**
     * @param {Http.IncomingMessage} request 
     * @returns {Promise<any>}
     */
    async retrieveRequest(request) {
        return new Promise((resolve, reject) => {
            let buffer;
            request.on("data", chunk => {
                if(buffer == null) {
                    buffer = chunk;
                }else {
                    if(buffer instanceof Buffer) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }else if(typeof buffer == "string") {
                        buffer += chunk;
                    }
                }
            });
            request.on("end", () => {
                let requestBody = buffer;
                if(requestBody != null && request.headers["content-type"] != null) {
                    let contentType = request.headers["content-type"];
                    if(contentType.startsWith("application/json") || contentType.startsWith("application/cloudevents+json")) {
                        if(requestBody instanceof Buffer) {
                            requestBody = JSON.parse(requestBody.toString("utf8"));
                        }else if(typeof requestBody == "string") {
                            requestBody = JSON.parse(requestBody);
                        }
                    }
                }
                resolve(requestBody);
            });
            request.on("error", error => {
                reject(error);
            })
        });
    }

    /**
     * @returns {string}
     */
    generateJwtToken() {
        let header = {
            typ: "JWT",
            alg: "HS256"
        };
        let now = Math.floor(new Date().getTime()/1000);
        let claim = {
            iss: now,
            exp: now + 60*60
        };
        let token = Buffer.from(JSON.stringify(header)).toString("base64").replace(/=+$/, "")+"."+Buffer.from(JSON.stringify(claim)).toString("base64").replace(/=+$/, "");
        return token+"."+createHmac("sha256", SECRET).update(token).digest("base64").replace(/=+$/, "");
    }

    /**
     * @param {string} token 
     */
    verifyJwtToken(token) {
        let elements = token.split(".");
        if(elements.length != 3) {
            throw new Error("Invalid token");
        }
        let header = JSON.parse(Buffer.from(elements[0], "base64").toString());
        let claim = JSON.parse(Buffer.from(elements[1], "base64").toString());
        let certificate = elements[2];
        if(header.typ != "JWT" || header.alg != "HS256") {
            throw new Error("Invalid token");
        }
        if(typeof claim.iss != "number" || typeof claim.exp != "number") {
            throw new Error("Invalid token");
        }
        if(claim.exp < new Date().getTime()/1000) {
            throw new Error("Invalid token");
        }
        let _token = Buffer.from(JSON.stringify(header)).toString("base64").replace(/=+$/, "")+"."+Buffer.from(JSON.stringify(claim)).toString("base64").replace(/=+$/, "");
        let _certificate = createHmac("sha256", SECRET).update(_token).digest("base64").replace(/=+$/, "");
        if(_certificate != certificate) {
            throw new Error("Invalid token");
        }
    }

    /**
     * @param {string} [pfId] 
     * @returns {object}
     */
    generateFootprint(pfId) {
        return {
            id: pfId == null ? (this.#data != null && this.#data.id != null ? this.#data.id : UUID()) : pfId,
            specVersion: "2.2.0",
            version: 0,
            created: formatToIso8601String(new Date(), true),
            status: "Active",
            companyName: "Demo Company",
            companyIds: (this.#data != null && this.#data.companyIds != null ? this.#data.companyIds : ["urn:uuid:"+UUID()]),
            productDescription: "Demo Product",
            productIds: (this.#data != null && this.#data.productIds != null ? this.#data.productIds : ["urn:uuid:"+UUID()]),
            productCategoryCpc: "49",
            productNameCompany: "Demo Product",
            comment: "",
            pcf: {
                declaredUnit: "kilogram",
                unitaryProductAmount: 100,
                pCfExcludingBiogenic: 3.241,
                fossilGhgEmissions: 2.982,
                fossilCarbonContent: 0.813,
                biogenicCarbonContent: 0,
                characterizationFactors: "AR6",
                ipccCharacterizationFactorsSources: ["AR6"],
                crossSectoralStandardsUsed: ["GHG Protocol Product standard"],
                boundaryProcessesDescription: "",
                referencePeriodStart: formatToIso8601String(new Date(new Date().getTime()-1000*60*60*24*30), true),
                referencePeriodEnd : formatToIso8601String(new Date(new Date().getTime()-1000*60*60*24*20), true),
                geographyCountry: "FR",
                exemptedEmissionsPercent: 0,
                exemptedEmissionsDescription: "",
                packagingEmissionsIncluded: false
            }
        };
    }
}