/**
 * Handles logins. 
 * (C) 2018 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

let logoutListeners = [];

function handleLoginResult(fetchResponse) {
    logoutListeners = [];   // reset listeners on sign in

    const apiURL = fetchResponse.url, headers = fetchResponse.headers, jsonResponseObject = fetchResponse.response;
    if (jsonResponseObject && jsonResponseObject.result) {
        apiman.addJWTToken(apiURL, headers, jsonResponseObject);
        session.set(WEBSCROLLS_CONSTANTS.USERID, jsonResponseObject.id); 
        session.set(WEBSCROLLS_CONSTANTS.USERNAME, jsonResponseObject.name);
        session.set(WEBSCROLLS_CONSTANTS.USERORG, jsonResponseObject.org);
        session.set(WEBSCROLLS_CONSTANTS.LOGGEDIN_USEROLE, jsonResponseObject.role);
        securityguard.setCurrentRole(WEBSCROLLS_CONSTANTS.USER_ROLE);  // we only have user and guest at this level 
        const postloginurl = session.get(WEBSCROLLS_CONSTANTS.POST_LOGIN_URL_KEY, WEBSCROLLS_CONSTANTS.ADMIN_MAIN_HTML);
        window.monkshu_env.apps[WEBSCROLLS_CONSTANTS.APP_NAME].main(new URL(postloginurl, window.location.href));
    } else {LOG.error(`Login failed.`); router.loadPage(`${WEBSCROLLS_CONSTANTS.LOGIN_HTML}?_error=true`);}
}

const isUserLoggedIn = _ => securityguard.getCurrentRole() == WEBSCROLLS_CONSTANTS.USER_ROLE;

const addLogoutListener = listener => logoutListeners.push(listener);

async function logout() {
    for (const listener of logoutListeners) await listener();

    const savedLang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    session.destroy(); 
    securityguard.setCurrentRole(WEBSCROLLS_CONSTANTS.GUEST_ROLE);
    session.set($$.MONKSHU_CONSTANTS.LANG_ID, savedLang);
    
	router.doIndexNavigation();
}

const interceptPageLoadData = _ => {
    router.addOnLoadPageData(WEBSCROLLS_CONSTANTS.LOGIN_HTML, async (data, _url) => {
	    data.LOGIN_API_KEY = apiman.getAPIKeyFor(`${WEBSCROLLS_CONSTANTS.API_PATH}}/login`); });
    router.addOnLoadPageData(WEBSCROLLS_CONSTANTS.LOGINRESULT_HTML, async (data, _url) => {
        data.LOGIN_API_KEY = apiman.getAPIKeyFor(`${WEBSCROLLS_CONSTANTS.API_PATH}}/login`); });
}

export const loginmanager = {handleLoginResult, logout, addLogoutListener, interceptPageLoadData, isUserLoggedIn}