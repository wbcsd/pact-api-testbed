/*!
 * Copyright 2017 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

/**
 * @param {Date|number} date 
 * @param {boolean} [fixedTimezone] fix timezone to UTC
 * @returns {?string}
 */
export function formatToIso8601String(date, fixedTimezone) {
    if(date == null) return null;
    if(typeof date == "number") {
        date = new Date(date);
    }
    let offset = date.getTimezoneOffset();
    let offsetString;
    if((fixedTimezone == null || !fixedTimezone) && offset != 0) {
        let offsetHour = Math.floor(offset/60);
        let offsetMinute = Math.floor(offset%60);
        if(offsetHour > 0) {
            offsetString = "-";
        }else {
            offsetString = "+";
            offsetHour *= -1;
        }
        offsetString += ("00"+offsetHour).slice(-2)+":"+("00"+offsetMinute).slice(-2);
    }else {
        offsetString = "Z";
    }
    if(fixedTimezone == null || !fixedTimezone) {
        return date.getFullYear() + 
            "-" +
            ("00"+(date.getMonth()+1)).slice(-2) +
            "-" +
            ("00"+date.getDate()).slice(-2) + 
            "T" +
            ("00"+date.getHours()).slice(-2) + 
            ":" +
            ("00"+date.getMinutes()).slice(-2) + 
            ":" +
            ("00"+date.getSeconds()).slice(-2) + 
            offsetString;
    }else {
        return date.getUTCFullYear() + 
            "-" +
            ("00"+(date.getUTCMonth()+1)).slice(-2) +
            "-" +
            ("00"+date.getUTCDate()).slice(-2) + 
            "T" +
            ("00"+date.getUTCHours()).slice(-2) + 
            ":" +
            ("00"+date.getUTCMinutes()).slice(-2) + 
            ":" +
            ("00"+date.getUTCSeconds()).slice(-2) + 
            offsetString;
    }
};

/**
 * @param {string} string 
 * @returns {Date|null}
 */
export function parseIso8601String(string) {
    if(string == null) return null;
    let result = new Date(string);
    if(result instanceof Date && isNaN(result.getTime())) {
        return null;
    }
    return result;
};
