/**
 * Permissions page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 * 
 * Site: 
 *  Read means theme list will show up, for themes where user can read post types, 
 *  Write means the user can create new themes
 *  Delete means the user can delete existing themes
 * 
 * Theme 
 *  Read means the user can read the post types
 *  Write means the user can create new post types
 *  Delete means the user can delete post types
 * 
 * Post Type
 *  Read means the user can read the posts
 *  Write means the user can create new posts
 *  Delete means the user can delete posts
 * 
 * Data Model Documented Below
 *  const testdata = {
 *      "site": {theme_count: 1, user_count: 4},
 *      "themes": [{"name":"default", "posttypes": [{"name":"home", "posts_count": 1, "theme":"default"}], "posttypes_count": 1}],
 *      "users": [
 *          {"icon": "AR", "name": "Anita Rao", "email": "anita.rao@example.com", "rule_count": 9, "first": true},
 *          {"icon": "DT", "name": "Daniel Tan", "email": "daniel.tan@example.com", "rule_count": 3},
 *          {"icon": "MS", "name": "Mei Suzuki", "email": "mei.suzuki@example.com", "rule_count": 0 },
 *          {"icon": "PR", "name": "Priya Nair", "email": "priya.nair@example.com", "rule_count": 3 }
 *      ],
 *      "selected_user": {"name": "Anita Rao", "email": "anita.rao@example.com"},
 *      "permissions": {
 *          "anita.rao@example.com": [
 *              "site|read", "site|write", "site|delete", 
 *              "site/default|read", "site/default|write", "site/default|delete",
 *              "site/default/home|read", "site/default/home|write", "site/default/home|delete",
 *          ],
 *          "daniel.tan@example.com": ["site|read", "site/default|read", "site/default/home|read"],
 *          "mei.suzuki@example.com": [],
 *          "priya.nair@example.com": ["site/default/home|read", "site/default/home|write", "site/default/home|delete"]
 *      }
 *  }
 */

import {post} from "./post.mjs";
import {theme} from "./theme.mjs";
import {session} from "/framework/js/session.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const API_USERCONTROL = `${WEBSCROLLS_CONSTANTS.API_PATH}/usercontrol`;

let currentdata;

async function createdata() {
    let users; try {users = await apiman.rest(API_USERCONTROL, "POST", {op: "getusers"}, true)} catch (err) {_logBackendAPIError(err);};
    let permissions; try{permissions = await apiman.rest(API_USERCONTROL, "POST", {op: "getpermissions"}, true);} catch (err) {_logBackendAPIError(err);};
    const themes = await theme.getthemes();
    if (!users?.length) {
        if (!session.get(WEBSCROLLS_CONSTANTS.LOGGEDIN_USEROLE).toString() == "admin") return {};  // nothing allowed
        users = [{userid: session.get(WEBSCROLLS_CONSTANTS.USERID).toString(), name: session.get(WEBSCROLLS_CONSTANTS.USERNAME).toString()}];
        permissions = [{userid: session.get(WEBSCROLLS_CONSTANTS.USERID).toString(), permissions:["site|read", "site|write", "site|delete"]}];
    }

    const _mappedPermissions = {}; for (const permission of permissions) _mappedPermissions[permission.userid] = permission.permissions;
    const _mappedThemes = []; for (const theme of themes) {
        const posttypes = await post.getPostTypes(theme);
        const objectToPush = {name: theme, 
            posttypes: await Promise.all(posttypes.map(async posttype => {return {name: posttype, posts_count: (await post.getPostsForPostType(theme, posttype))?.length||0, theme}})),
            posttypes_count: posttypes.length
        };
        _mappedThemes.push(objectToPush);
    }
    const _mappedUsers = users.map(user => { return {
        icon: user.name.trim().includes(" ") ? user.name.trim().split(/\s+/).at(0)[0] + user.name.trim().split(/\s+/).at(-1)[0] : user.name.trim().slice(0, 2),
        name: user.name, email: user.userid, rule_count: _mappedPermissions[user.userid]?.length || 0,
        first: user.userid == users[0].userid ? true : undefined
    }});

    currentdata = {
        site: {theme_count: themes.length, user_count: users.length},
        themes: _mappedThemes,
        users: _mappedUsers,
        permissions: _mappedPermissions,
        selected_user: users.length?{name: users[0].name, email: users[0].userid}:undefined
    }

    return currentdata;
}

function pageRendered() {
    permissions.pagefunctions.countRules();
}

function userSelected(email) {
    if (!email) if (!currentdata?.selected_user) return; else email = currentdata.selected_user.email;
    else for (const user of currentdata.users) if (user.email == email) {currentdata.selected_user.email = user.email; currentdata.selected_user.name = user.name;};

    const userpermissions = currentdata.permissions[email];
    permissions.pagefunctions.loadPermissions(email, userpermissions);
}

const updateSelectedUsersRules = (permissions) => currentdata.permissions[currentdata.selected_user.email] = permissions;

function addUser(name, email) {
    if (currentdata.permissions[email]) return false;   // user already exists

    const icon = name.trim().includes(" ") ? name.trim().split(/\s+/).at(0)[0] + name.trim().split(/\s+/).at(-1)[0] : name.trim().slice(0, 2);
    currentdata.users.push({icon, name, email, rule_count: 0});
    currentdata.selected_user = {name, email};
    currentdata.permissions[email] = [];
    userSelected(email);
    return true;
}

async function savePermissions() {
    const _mappedUsers = currentdata.users.map(user => {return {userid: user.email, name: user.name}});
    if (!await apiman.rest(API_USERCONTROL, "POST", {op: "setusers", permissions: _mappedUsers}, true))
        return false;

    const _mappedPermissions = []; for (const [userid, permissions] of Object.entries(currentdata.permissions)) 
        _mappedPermissions.push({userid, permissions});
    try {return await apiman.rest(API_USERCONTROL, "POST", {op: "setpermissions", permissions: _mappedPermissions}, true);}
    catch (err) {_logBackendAPIError(err);}
}

const _logBackendAPIError = err => WEBSCROLLS_LOG.error(`Backend API error calling user control. The error is: ${err}`);

export const permissions = {createdata, logout: loginmanager.logout, userSelected, addUser, pageRendered, 
    updateSelectedUsersRules, savePermissions, 
    pagefunctions: {add: function (name, functionPointer) {this[name] = functionPointer}}}