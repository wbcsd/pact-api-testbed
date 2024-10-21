/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import { Http } from "./http.js";

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
    return response.body.filter(entry => entry.type == "file" && !entry.name.startsWith(".")).map(entry => entry.name);
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