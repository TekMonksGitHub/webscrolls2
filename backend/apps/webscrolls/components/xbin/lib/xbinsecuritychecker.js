/** 
 * (C) 2023 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 * 
 * Checks JWT tokerns or just org based API keys.
 */

const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const db = require(`${XBIN_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();

const CHECKER_NAME = "xbin_security_checker";
const CMSSECURITY_MODIFIERS = [];

/** Called during init of the server */
function initSync() {
    APIREGISTRY.addCustomSecurityChecker(CHECKER_NAME, this);
}

/**
 * Called by API registry to check security
 * @param {*} apiregentry Reg entry
 * @param {*} _url URL of API
 * @param {*} req Request object
 * @param {*} headers Headers
 * @param {*} _servObject Server object
 * @param {*} reason reason
 * @returns true if secure else false
 */
async function checkSecurity(apiregentry, url, req, headers, servObject, reason) {
    if (servObject.monkshu_backend_server.isThisAnEarlySecurityCheck(apiregentry, url, req, headers, servObject, reason)) return true; // if JWT token is OK, we are OK for early security as well

    const loginID = cms.getLoginModule().getID(headers); if (!loginID) {
        LOG.error(`Incoming request does not have a logged in userid set. Authorization Rejected.`);
        reason.reason = "API USERID Error"; reason.code = 403; return false; // xbin needs user ID
    }

    const extraInfo = req.extraInfo, path = req[apiregentry.query.xbin_security_checker_pathparam||"path"] ||
        (apiregentry.query.xbin_security_checker_pathoptional == "true" ? "/" : null);
    const xbinop = apiregentry.query.xbinop;
    if ((!path) || (!xbinop)) {
        LOG.error(`Incoming request does not have a path or xbinop for the operation. Authorization Rejected.`);
        reason.reason = "API USERID Error"; reason.code = 403; return false; // xbin needs user ID
    }

    const isOperationSecureForXbin = await _checkPermissions(headers, path, extraInfo, xbinop);
	const isOperationSecureForPluggableSecurityModifiers = CMSSECURITY_MODIFIERS.length ? (await (async _=>{
        let op_safe = true; for (const cmsSecurityModifier of CMSSECURITY_MODIFIERS) {
            op_safe = await cmsSecurityModifier(headers, path, extraInfo, xbinop); if (!op_safe) break; }
        return op_safe;
    })()) : true;

    return isOperationSecureForXbin && isOperationSecureForPluggableSecurityModifiers;
}

/**
 * Adds CMS security modifier 
 * @param {function} modifier The path modifier
 */
const addXBinSecurityModifier = modifier => CMSSECURITY_MODIFIERS.push(modifier);

/**
 * Removes CMS security modifier 
 * @param {function} modifier The path modifier
 */
const removeXBinSecurityModifier = modifier => CMSSECURITY_MODIFIERS.indexOf(modifier) ? CMSSECURITY_MODIFIERS.splice(CMSSECURITY_MODIFIERS.indexOf(modifier),1) : null;

/**
 * Updates path permissions for a given user. To delete all user permissions set pathsAndPermissions
 * to a null object. Typically the permissions should be read, write, and delete. However, they can be
 * anything - as long as permissions being set, match those which are being checked in the APIs. Out of
 * the box XBin APIs use read, write and delete as the set, but it can be adjusted in the API registry.
 * @param {string} userid The user ID
 * @param {object} pathsAndPermissions The object of paths and permissions - {"path" -> "permission"}
 * @param {object} extraInfo The extra info object
 * @returns true on success, and false on error
 */
async function modifyUserPermissions(userid, pathsAndPermissions, extraInfo) {
    if ((!pathsAndPermissions) || Object.keys(pathsAndPermissions).length === 0) 
        return await db.runCmd("DELETE FROM permissions WHERE userid=?", [userid]);
    const fixedPathsAndPermissions = {}; for (const [path,permissions] of Object.entries(pathsAndPermissions)) 
        fixedPathsAndPermissions[await cms.getFullPath(path, extraInfo)] = permissions;
    return await db.runCmd("REPLACE INTO permissions (userid, permissions) VALUES(?,?)", [userid, JSON.stringify(fixedPathsAndPermissions)]);
}

const _checkPermissions = async (headers, path, extraInfo, operation) => {
    const fullpath = await cms.getFullPath(headers, path, extraInfo), loginID = cms.getLoginModule().getID(headers);
	const security_rows = await db.getQuery(`
        SELECT p.userid, j.key AS matched_path, j.value AS permissions
        FROM permissions p, json_each(p.permissions) j
        WHERE (p.userid = :loginID OR p.userid = '*')
            AND (j.key = '*' OR j.key = :fullpath OR :fullpath LIKE j.key || '%')
        ORDER BY 
            LENGTH(j.key) DESC,
            CASE WHEN p.userid = :loginID THEN 0 ELSE 1 END 
        LIMIT 1;
    `, {loginID, fullpath});
    const matchedObject = security_rows && security_rows.length ? security_rows[0] : {permissions:'[]'};
    const permissions = JSON.parse(matchedObject.permissions);
    if (permissions.includes("*") || permissions.includes(operation)) return true; else return false;
}

module.exports = {checkSecurity, initSync, addXBinSecurityModifier, removeXBinSecurityModifier, modifyUserPermissions};