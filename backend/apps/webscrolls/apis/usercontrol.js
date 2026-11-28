/**
 * User control API.
 * 
 * Params
 * 	op: adduser, deleteuser, getusers, getpermissions, setusers, setpermissions
 * 
 * Returns or expects users array {users: [{userid, name}]} 
 * or permissions array {permissions: [{userid, permissions:[]}]}
 * 
 * Each permission must be of the form asset_path: site/<theme>/<post_type>|[read|write|delete]
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const db = require(`${WEBSCROLLS_CONSTANTS.LIB_DIR}/db.js`);
const app = require(`${WEBSCROLLS_CONSTANTS.LIB_DIR}/app.js`);
const login = require(`${WEBSCROLLS_CONSTANTS.API_DIR}/login.js`);
const cms = require(`${WEBSCROLLS_CONSTANTS.COMPONENTS_DIR}/xbin/lib/cms.js`);
const xbinsecuritychecker = require(`${WEBSCROLLS_CONSTANTS.COMPONENTS_DIR}/xbin/lib/xbinsecuritychecker.js`);

exports.doService = async (jsonReq, headers) => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure for usercontrol."); return CONSTANTS.FALSE_RESULT;}

	if (jsonReq.op == "adduser") return {result: await db.addUser(jsonReq.userid, jsonReq.name)};
    else if (jsonReq.op == "deleteuser") {
        const userid = jsonReq.userid;
        if (!await xbinsecuritychecker.modifyUserPermissions(userid, {})) {
            LOG.error(`deleteuser: XBin revoke failed for ${userid}, user not deleted.`);
            return CONSTANTS.FALSE_RESULT;
        }
        const result = await db.deleteUser(userid);
        if (!result) {
            LOG.error(`deleteuser: DB delete failed for ${userid}, restoring XBin permissions.`);
            try {
                const failed = await _syncXBin(await db.getPermissions(userid), [], headers);
                if (failed.length) LOG.error(`deleteuser: XBin restore failed for ${userid}, DB and XBin out of sync.`);
            } catch (err) { LOG.error(`deleteuser: XBin restore failed for ${userid}: ${err}, databases out of sync as Xbin doesn't have these permissions anymore`); }
        }
        return {result};
    }
    else if (jsonReq.op == "getusers") {
        const users = await db.getUserOrAllUsers(jsonReq.userid);
        return {users, result: users?.length?true:false};
    } 
    else if (jsonReq.op == "getpermissions") {
        const permissions = await db.getPermissions(jsonReq.userid);
        return {permissions, result: permissions?.length?true:false};
    } 
    else if (jsonReq.op == "setusers") {
        const oldUsers = await db.getUserOrAllUsers();
        if (!Array.isArray(oldUsers)) {LOG.error("setusers: could not read current users, aborting."); return CONSTANTS.FALSE_RESULT;}
        const newIDs = new Set(jsonReq.users.map(u => u.userid));
        const removedIDs = oldUsers.map(u => u.userid).filter(id => !newIDs.has(id));
        const revoked = []; for (const userid of removedIDs) {
            if (!await xbinsecuritychecker.modifyUserPermissions(userid, {})) {
                LOG.error(`setusers: XBin revoke failed for ${userid}, aborting.`);
                await _restoreXBin(revoked, headers);
                return CONSTANTS.FALSE_RESULT;
            }
            revoked.push(userid);
        }
        const result = await db.setUsers(jsonReq.users);
        if (!result) {LOG.error("setusers: DB update failed, restoring XBin permissions."); await _restoreXBin(revoked, headers);}
        return {result};
    }
    else if (jsonReq.op == "setpermissions") {
        const oldpermissions = await db.getPermissions();
        if (!Array.isArray(oldpermissions)) {LOG.error("setpermissions: could not read current permissions, aborting."); return CONSTANTS.FALSE_RESULT;}
        if (!await db.setPermissions(jsonReq.permissions)) return CONSTANTS.FALSE_RESULT;
        try {
            const failed = await _syncXBin(jsonReq.permissions, oldpermissions, headers);
            if (failed.length) throw new Error(`XBin update failed for ${failed.join(", ")}`);
            return CONSTANTS.TRUE_RESULT;
        } catch (err) {
            LOG.error(`setpermissions failed, rolling back: ${err}`);
            try {
                await db.setPermissions(oldpermissions);
                const failed = await _syncXBin(oldpermissions, jsonReq.permissions, headers);
                if (failed.length) LOG.error(`Rollback: XBin restore failed for ${failed.join(", ")}`);
            } catch (rollbackErr) { LOG.error(`Rollback failed, DB and XBin may be out of sync: ${rollbackErr}`); }
            return CONSTANTS.FALSE_RESULT;
        }
    }
    else return CONSTANTS.FALSE_RESULT;
}

// Re-applies the DB's current permissions to XBin for the given users (used to undo a revoke).
async function _restoreXBin(userids, headers) {
    if (!userids.length) return;
    try {
        const ids = new Set(userids);
        const failed = await _syncXBin((await db.getPermissions()).filter(p => ids.has(p.userid)), [], headers);
        if (failed.length) LOG.error(`XBin restore failed for ${failed.join(", ")}, DB and XBin out of sync.`);
    } catch (err) { LOG.error(`XBin restore failed for ${userids.join(", ")}: ${err}`); }
}

// Makes XBin match targetPermissions exactly: applies every target user's paths,
// and clears users present in previousPermissions but absent from the target.
// Returns the userids whose XBin update failed.
async function _syncXBin(targetPermissions, previousPermissions, headers) {
    const target = await _createXBinPermissions(targetPermissions, headers);
    const targetUsers = new Set(target.map(p => p.userid));
    const toClear = [...new Set(previousPermissions.map(p => p.userid))].filter(u => !targetUsers.has(u));
    const failed = [];
    for (const p of target)
        if (!await xbinsecuritychecker.modifyUserPermissions(p.userid, p.pathsAndPermissions)) failed.push(p.userid);
    for (const userid of toClear)
        if (!await xbinsecuritychecker.modifyUserPermissions(userid, {})) failed.push(userid);
    return failed;
}

// input: [{user1, permissions:["site/theme|read"...]}, {user2: permissions:["site/theme/post|read"...]}]
// reformattedPermissions => {user1: {pathsAndPermissions: {path1: [], path2: [], ...}, user2: {pathsAndPermissions: {path1: [], path2: [], ...}}
// return: [{user1, pathsAndPermissions: {path1: ["read", "write"], path2: ["read", "write", "delete"], ...}}]
async function _createXBinPermissions(userids_and_permissions, headers) {
    const reformattedPermissions = {}, id = login.getID(headers), org = login.getOrg(headers);
    for (const userid_and_permissions of userids_and_permissions) {
        if (!reformattedPermissions[userid_and_permissions.userid]) 
            reformattedPermissions[userid_and_permissions.userid] = {pathsAndPermissions: {}};
        const thisUserIDObject = reformattedPermissions[userid_and_permissions.userid];
        for (const permission of userid_and_permissions.permissions) {
            const thisPath = permission.split("|")[0].replace(/^site\/?/, "/"); // can be / or /theme or /theme/post_type
            const thisFullPath = thisPath.split("/").length < 3 ? await cms.getFullPath({id, org}, thisPath, app.getExtraInfo(app.theme)) :
                await cms.getFullPath({id, org}, thisPath, app.getExtraInfo(app.cms));
            const permissionThis = permission.split("|")[1];
            const pathPermissionsArray = thisUserIDObject.pathsAndPermissions[thisFullPath]||[];
            if (!pathPermissionsArray.includes(permissionThis)) pathPermissionsArray.push(permissionThis);
            thisUserIDObject.pathsAndPermissions[thisFullPath] = pathPermissionsArray;
        }
    }

    const retPermissions = []; for (const userid of Object.keys(reformattedPermissions)) 
        retPermissions.push({userid, pathsAndPermissions: reformattedPermissions[userid].pathsAndPermissions});
    return retPermissions;
}

const PERM_RE = /^site(\/(?!\.{1,2}(\/|\|))[^\/|\\]+){0,2}\|(read|write|delete)$/;
const validateRequest = jsonReq => {
    if (!jsonReq?.op) return false;
    if (["adduser", "deleteuser"].includes(jsonReq.op) && !jsonReq.userid) return false;
    if (jsonReq.op == "setusers" && !(Array.isArray(jsonReq.users) && jsonReq.users.every(u => u?.userid) &&
        new Set(jsonReq.users.map(u => u.userid)).size == jsonReq.users.length)) return false;   
    if (jsonReq.op == "setpermissions") return Array.isArray(jsonReq.permissions) &&
        jsonReq.permissions.every(p => p?.userid && Array.isArray(p.permissions) && p.permissions.every(s => typeof s == "string" && PERM_RE.test(s))) &&
        new Set(jsonReq.permissions.map(p => p.userid)).size == jsonReq.permissions.length;
    return true;
}