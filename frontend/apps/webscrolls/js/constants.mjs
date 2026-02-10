/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: MIT - see enclosed license.txt file.
 */

const APP_NAME = "webscrolls";
const FRONTEND = new URL(window.location).protocol + "//" + new URL(window.location).host;
const BACKEND = new URL(window.location).protocol + "//" + new URL(window.location).host + ":9090";
const APP_PATH = `${FRONTEND}/apps/${APP_NAME}`;
const API_PATH = `${BACKEND}/apps/${APP_NAME}`;
const LOGIN_HTML = APP_PATH+"/login.html";
const ADMIN_MAIN_HTML = APP_PATH+"/admin/post.html";
const LOGINRESULT_HTML = APP_PATH+"/loginresult.html";
const TKMLOGINAPP_URL = "https://login.tekmonks.com";

export const WEBSCROLLS_CONSTANTS = {
    FRONTEND, BACKEND, APP_PATH, APP_NAME, API_PATH, LOGIN_HTML, LOGINRESULT_HTML, TKMLOGINAPP_URL, ADMIN_MAIN_HTML,
    INDEX_HTML: APP_PATH+"/index.html",
    ERROR_HTML: FRONTEND+"/framework/error.html",

    API_LOGIN: API_PATH+"/login",
    USERID: "userid",
    USERPW: "pw",
    TIMEOUT: 3600000,
    USERNAME: "username",
    USERORG: "userorg",
    LOGGEDIN_USEROLE: "userrole",
    POST_LOGIN_URL_KEY: "_webscrolls_post_login_url",

    TKMLOGIN_LIB: `${APP_PATH}/3p/tkmlogin.mjs`,

    USER_ROLE: "user",
    GUEST_ROLE: "guest",

    API_KEYS: {"*":"reeiwu83409oesnf9823ydwejidw492053ldmqogelr02479"},
    API_KEY_HEADER: "X-API-Key"
}

WEBSCROLLS_CONSTANTS.PERMISSIONS_MAP = {
    user:[".*\.html"], 
    guest:[".*\.html"]
}