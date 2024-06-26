/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import querystring from "node:querystring";

export class Http {
    /**
     * @typedef {object} HttpResponse
     * @property {number|undefined} status
     * @property {import("node:http").IncomingHttpHeaders} headers
     * @property {object} body
     */
    
    /**
     * @param {"get"|"post"|"patch"|"put"|"delete"|"option"|"head"} method 
     * @param {string} requestPath 
     * @param {import("node:http").IncomingHttpHeaders} [requestHeader] 
     * @param {object} [requestBody] 
     * @returns {Promise<HttpResponse>}
     */
    static async request(method, requestPath, requestHeader, requestBody) {
        const Http = await (requestPath.startsWith("https") ? import("https") : import("http"));
        if(requestBody != null && requestHeader != null) {
            let contentType = requestHeader["content-type"];
            if(contentType != null) {
                if(contentType.startsWith("application/json")) {
                    requestBody = JSON.stringify(requestBody);
                }else if(contentType.startsWith("application/x-www-form-urlencoded")) {
                    requestBody = querystring.stringify(requestBody);
                }else if(contentType.startsWith("application/cloudevents+json")) {
                    requestBody = JSON.stringify(requestBody);
                }else {
                    requestBody = null;
                }
            }else {
                requestBody = null;
            }
            if(requestHeader["content-length"] == null) {
                requestHeader["content-length"] = Buffer.byteLength(requestBody).toString();
            }
        }else {
            requestBody = null;
        }
        return new Promise((resolve, reject) => {
            let connection = Http.request(requestPath, {
                method: method,
                headers: requestHeader
            }, response => {
                let contentType = response.headers["content-type"];
                let status = response.statusCode;
                let buffer;
                response.on("data", chunk => {
                    if(buffer == null) buffer = chunk;
                    else buffer = Buffer.concat([buffer, chunk]);
                });
                response.on("end", () => {
                    let result = buffer;
                    if(result != null) {
                        if(contentType != null) {
                            if(contentType.startsWith("application/json")) {
                                result = result.toString("utf8");
                                try {
                                    result = JSON.parse(result);
                                }catch(error) {
                                    console.error(error);
                                }
                            }
                        }
                    }
                    resolve({status: status, headers: response.headers, body: result});
                });
            });
            connection.on("error", error => {
                reject(error);
            });
            if(requestBody != null) {
                connection.write(requestBody);
            }
            connection.end();
        });
    }
}