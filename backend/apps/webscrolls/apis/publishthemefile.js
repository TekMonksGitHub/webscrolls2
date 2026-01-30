/**
 * Publishes the given theme file.
 * 
 * Params
 *  themeurl: theme dir URL
 *  template: HTML template
 *  schemaJSON: Schema JSON
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");
const fspromises = require("fs").promises;
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);

exports.doService = async jsonReq => {
    if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for publishing ${jsonReq.posturl}.`); return CONSTANTS.FALSE_RESULT;}
    
    LOG.debug("Got publish theme file for path: " + jsonReq.themeurl);

    try {
        const finalPath = path.resolve(WEBSCROLLS_CONSTANTS.FRONTEND_ROOT+"/"+new URL(jsonReq.themeurl).pathname);
        const themePath = path.dirname(finalPath), parentThemeDir = path.resolve(`${themePath}/../`);
        if (!await _initThemePath(themePath, parentThemeDir)) {LOG.error(`Path init failed for ${finalPath}`); return CONSTANTS.FALSE_RESULT;}

        const themefilename = jsonReq.themefilename || path.basename(finalPath).split(".")[0];
        const themename = path.posix.normalize(finalPath).split("/").at(-2);

        let posttypes = JSON.parse(await fspromises.readFile(`${themePath}/schemas/posttypes.json`, "utf8"));
        posttypes = [...(new Set(posttypes).add(themefilename))];	// remove duplicates in case of edits to an existing theme file
        const posttypesJSON = JSON.stringify(posttypes, null, 2);

        let themes = JSON.parse(await fspromises.readFile(`${parentThemeDir}/themes.json`, "utf8"));
        themes = [...(new Set(themes).add(themename))];	// remove duplicates in case of edits to an existing theme file
        const themesJSON = JSON.stringify(themes, null, 2);

        await fspromises.writeFile(`${parentThemeDir}/themes.json`, themesJSON, "utf8"); 
        await fspromises.writeFile(finalPath, jsonReq.template, "utf8"); 
        await fspromises.writeFile(`${themePath}/schemas/${themefilename}.json`, jsonReq.schemaJSON, "utf8"); 
        await fspromises.writeFile(`${themePath}/schemas/posttypes.json`, posttypesJSON, "utf8");
        return CONSTANTS.TRUE_RESULT;
    } catch (err) {LOG.error(`Error writing to ${jsonReq.themeurl} due to error: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

async function _initThemePath(this_theme_path, themespath) {
    if (await serverutils.exists(this_theme_path)) return true;    // assume everything for this theme exists

    if (!(await serverutils.exists(themespath))) try {
        await fspromises.mkdir(`${themespath}`, {recursive: true});
        await fspromises.writeFile(`${themespath}/themes.json`, "[]", "utf8");
    } 
    catch (err) { // create themes parent dir if needed
        LOG.error(`Error initializing the themes root directory ${this_theme_path}. Error: ${err}`); 
        return false;
    }

    try {await fspromises.mkdir(`${this_theme_path}/schemas`, {recursive: true});} 
    catch (err) {LOG.error(`Error creating theme or schema directory ${this_theme_path}. Error: ${err}`); return false;}
    try {await fspromises.writeFile(`${this_theme_path}/schemas/posttypes.json`, "[]", "utf8");}
    catch (err) {LOG.error(`Error creating posttypes.json file in theme path ${this_theme_path}/schemas. Error: ${err}`); return false;}
    
    return true;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.themeurl && jsonReq.template && jsonReq.schemaJSON);
