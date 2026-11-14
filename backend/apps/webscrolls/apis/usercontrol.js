/**
 * User control API.
 * 
 * Params
 * 	op: adduser, deleteuser, getusers, getpermissions, setpermissions
 * 
 * Returns or expects users array {users: [{userid, name}]} 
 * or permissions array {permissions: [{userid, permissions:[]}]}
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const db = require(`${WEBSCROLLS_CONSTANTS.LIB_DIR}/db.js`);

exports.doService = async jsonReq => {
    if (!validateRequest(jsonReq)) {LOG.error("Validation failure for usercontrol."); return CONSTANTS.FALSE_RESULT;}

	if (jsonReq.op == "adduser") return {result: await db.addUser(jsonReq.userid, jsonReq.name)};
    else if (jsonReq.op == "deleteuser") return {result: await db.deleteUser(jsonReq.userid)};
    else if (jsonReq.op == "getusers") {
        const users = await db.getUserOrAllUsers(jsonReq.userid);
        return {users, result: users.length?true:false};
    } 
    else if (jsonReq.op == "getpermissions") {
        const permissions = await db.getPermissions(jsonReq.userid);
        return {permissions, result: permissions.length?true:false};
    } 
    else if (jsonReq.op == "setusers") return {result: await db.setUsers(jsonReq.users)};
    else if (jsonReq.op == "setpermissions") return {result: await db.setPermissions(jsonReq.permissions)};
    else return CONSTANTS.FALSE_RESULT;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.op);
