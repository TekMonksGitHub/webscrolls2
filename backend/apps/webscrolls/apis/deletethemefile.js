/**
 * Publishes the given theme file.
 * 
 * Params
 *  themeurl: theme dir URL
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");
const fspromises = require("fs").promises;

exports.doService = async jsonReq => {
    if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for publishing ${jsonReq.posturl}.`); return CONSTANTS.FALSE_RESULT;}
    
    LOG.debug("Got delete theme file for path: " + jsonReq.themeurl);

    try {
        const finalPath = path.resolve(WEBSCROLLS_CONSTANTS.FRONTEND_ROOT+"/"+new URL(jsonReq.themeurl).pathname);
        const themePath = path.dirname(finalPath);

        const themefilename = jsonReq.themefilename || path.basename(finalPath).split(".")[0];

        let posttypes = JSON.parse(await fspromises.readFile(`${themePath}/schemas/posttypes.json`, "utf8"));
        posttypes.splice(posttypes.indexOf(themefilename), 1)
        const posttypesJSON = JSON.stringify(posttypes, null, 2);

        await fspromises.rm(finalPath, {force: true}); 
        await fspromises.rm(`${themePath}/schemas/${themefilename}.json`, {force: true}); 
        await fspromises.writeFile(`${themePath}/schemas/posttypes.json`, posttypesJSON, "utf8");
        return CONSTANTS.TRUE_RESULT;
    } catch (err) {LOG.error(`Error writing to ${jsonReq.themeurl} due to error: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.themeurl);
