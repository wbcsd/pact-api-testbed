/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { Http } from "./http.js";
import { readFileSync } from "fs";


const GITHUB_API_VERSION = "2022-11-28";
const USER_AGENT = "pact-api-testbed";

/**
 * @param {string} owner Repository holders
 * @param {string} repository 
 * @param {string} [path] Path from repository root (no leading slash required)
 * @returns {Promise<Array<string>>} File names
 */
export async function getFileList(owner, repository, path) {
    let response = await Http.request("get", `https://api.github.com/repos/${owner}/${repository}/contents/${path != null ? path : ""}`, {
        Accept: "application/json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": USER_AGENT
    });
    if(response.status != 200) {
        throw new Error(`An error occurred when accessing GitHub. Status:${response.status} Body:${response.body}`);
    }
    if(response.body == null || !Array.isArray(response.body)) {
        throw new Error(`The file list retrieved from GitHub was not an array. Body:${response.body}`);
    }
    return response.body
        .filter(entry => entry.type == "file" && /pact-openapi-\d+\.\d+\.\d+\.yaml/.test(entry.name))
        .map(entry => entry.name);
}

/**
 * @param {string} owner Repository holders
 * @param {string} repository 
 * @param {string} path Path from repository root (no leading slash required)
 * @returns {Promise<Buffer>}
 */
export async function getFile(owner, repository, path) {
    let response = await Http.request("get", `https://api.github.com/repos/${owner}/${repository}/contents/${path}`, {
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": USER_AGENT
    });
    if(response.status != 200) {
        throw new Error(`An error occurred when accessing GitHub. Status:${response.status} Body:${response.body}`);
    }
    if(response.body == null) {
        throw new Error(`File data is empty.`);
    }
    if(!(response.body instanceof Buffer)) {
        throw new Error(`File data is not binary. Body:${response.body}`);
    }
    return response.body;
}

/**
 * Load a resource from a URL.
 * @param {string} url 
 * @returns {Promise<Buffer>}
 * @throws {Error}
 */
export async function loadResource(url)
{
    if (url.startsWith("http://") || url.startsWith("https://")) {
        let response = await Http.request("get", url);
        if(response.status != 200) {
            throw new Error(`An error occurred while downloading ${url}. Status:${response.status} Body:${response.body}`);
        }
        if(response.body == null) {
            throw new Error(`File data is empty.`);
        }
        if(!(response.body instanceof Buffer)) {
            throw new Error(`File data is not binary. Body:${response.body}`);
        }
        return response.body;
    } 
    else if (url.startsWith("file://") || !/^\w+:\/\//.test(url)) {
        // Any URL starting witj file:// or not containing a scheme is treated as a local file path.  
        let data = readFileSync(url);
        if (!(data instanceof Buffer)) {
            throw new Error(`File data is not binary: ${data}`);
        }
        return data;
    } 
    throw new Error(`The URL scheme is not supported. URL:${url}`);
}


/**
 * Load a text resource from a URL.
 * @param {string} url 
 * @param {BufferEncoding} [encoding='utf8'] The encoding to use for the text conversion
 * @returns {Promise<string>}
 * @throws {Error}
 */
export async function loadTextResource(url, encoding = 'utf8') {
    return (await loadResource(url)).toString(encoding);
}
