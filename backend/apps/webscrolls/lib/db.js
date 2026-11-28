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
    const rows = await db.getQuery("SELECT * FROM permissions"+(userid?" WHERE userid = ?":""), 
        userid?[userid]:undefined) || [];
    if (!Array.isArray(rows)) {LOG.error("getPermissions: DB query failed."); return null;}
    const permissions = [];
    for (const row of rows) try {
        permissions.push({userid: row.userid, permissions: row.permissions ? JSON.parse(row.permissions) : []});
    } catch (err) {LOG.error(`getPermissions: corrupt permissions JSON for ${row.userid}: ${err}`); return null;}
    return permissions;
}

exports.getUserOrAllUsers = async function(userid) {
    const users_raw = await db.getQuery("SELECT * FROM users"+(userid?" WHERE userid = ?":""), 
        userid?[userid]:undefined) || [];
    if (!Array.isArray(rows)) {LOG.error("getUserOrAllUsers: DB query failed."); return null;}
    const users_object = users_raw.map(row => {return {userid: row.userid, name: row.name}});
    return users_object;
}

exports.setPermissions = async function(permissions) {
    if (!Array.isArray(permissions)) {LOG.error(`setPermissions: bad permissions object ${JSON.stringify(permissions)}, nothing changed.`); return false;}
    const seen = new Set();
    for (const p of permissions) {
        if (!p?.userid) {LOG.error(`setPermissions: missing user ID in ${JSON.stringify(p)}, nothing changed.`); return false;}
        if (seen.has(p.userid)) {LOG.error(`setPermissions: duplicate user ID ${p.userid}, nothing changed.`); return false;}
        seen.add(p.userid);
    }
    const transactions = [
        {cmd: "DELETE FROM permissions", params: []},   // replace the whole table, as the API expects
        ...permissions.map(p => ({cmd: "INSERT INTO permissions (userid, permissions) VALUES (?,?)", params: [p.userid, JSON.stringify(p.permissions || [])]}))
    ];
    return await db.runTransaction(transactions);
}


exports.setUsers = async function(users) {
    const seen = new Set();
    for (const user of users) {
        if (seen.has(user.userid)) {LOG.error(`setUsers: duplicate user ID ${user.userid}, nothing changed.`); return false;}
        seen.add(user.userid);
    }
    const transactions = [
        {cmd: "DELETE FROM users", params: []},
        ...users.map(user => ({cmd: "INSERT INTO users (userid, name) VALUES (?,?)", params: [user.userid, user.name ?? null]})),
        {cmd: "DELETE FROM permissions WHERE userid NOT IN (SELECT userid FROM users)", params: []}   // drop orphaned permissions
    ];
    return await db.runTransaction(transactions);
}

exports.addUser = async function (userid, name) {
    if (!userid) return false;
    return await db.runCmd("REPLACE INTO users (userid, name) VALUES (?,?)", [userid, name]);
}

exports.deleteUser = async function (userid) {
    const transactions = [
        {cmd: "DELETE FROM users WHERE userid = ?", params: [userid]},
        {cmd: "DELETE FROM permissions WHERE userid = ?", params: [userid]}
    ];
    return await db.runTransaction(transactions);
}