/**
 * DB class.
 * (C) 2026 TekMonks. All rights reserved.
 */

const path = require("path");

const DB_PATH = (WEBSCROLLS_CONSTANTS.CONF.DB_SERVER_HOST||"")+path.resolve(`${WEBSCROLLS_CONSTANTS.DB_DIR}/webscrolls.db`).replaceAll(path.sep, path.posix.sep);
const DB_CREATION_SQLS = require(`${WEBSCROLLS_CONSTANTS.DB_DIR}/wsdbschema.json`);
const db = require(`${CONSTANTS.LIBDIR}/db.js`).getDBDriver("sqlite", DB_PATH, DB_CREATION_SQLS);

exports.getDB = _ => db;

exports.getPermissions = async function(userid) {
    const permissions_rows_raw = await db.getQuery("SELECT * FROM permissions"+(userid?" WHERE userid = ?":""), 
        userid?[userid]:undefined) || [];
    const permissions_object = permissions_rows_raw.map(row => {return {
        userid: row.userid, 
        permissions: row.permissions ? JSON.parse(row.permissions): []
    }});
    return permissions_object;
}

exports.getUserOrAllUsers = async function(userid) {
    const users_raw = await db.getQuery("SELECT * FROM users"+(userid?" WHERE userid = ?":""), 
        userid?[userid]:undefined) || [];
    const users_object = users_raw.map(row => {return {userid: row.userid, name: row.name}});
    return users_object;
}

exports.setPermissions = async function(permissions_object=[]) {
    if (!Array.isArray(permissions_object)) {LOG.error(`Bad permissions object ${JSON.stringify(permissions_object)}`); return false;}

    const transactions = [];
    for (const permission_object of permissions_object) {
        if (!permission_object.userid) {LOG.error(`Bad permissions, missing user ID in ${JSON.stringify(permission_object)}`); continue;}
        transactions.push({
            cmd: "REPLACE INTO permissions (userid, permissions) VALUES (?,?)",
            params: [permission_object.userid, JSON.stringify(permission_object.permissions||[])] });
    }
    const transactionResult = transactions.length ? await db.runTransaction(transactions) : true;
    return transactionResult;
}

exports.addUser = async function (userid, name) {
    if (!userid) return false;
    return await db.runCmd("REPLACE INTO users (userid, name) VALUES (?,?)", [userid, name]);
}