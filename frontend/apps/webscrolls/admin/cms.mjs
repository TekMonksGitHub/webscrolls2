/**
 * Main entry point for admin data and handling. Initially
 * called from application.mjs 
 *  
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {loginmanager} from "../js/loginmanager.mjs";

const CMSTYPE_KEY = "_org_webscrolls_cmstype_key_";
const current_cms_type = session.get(CMSTYPE_KEY, "cms");

function createdata() {
    const extraInfo = {apppath: `/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`, cmstype: current_cms_type};
    const extraInfoEncoded = util.stringToBase64(JSON.stringify(extraInfo));
    return {
        cmstypes: [
            {name: "CMS", type: "cms", selected: current_cms_type == "cms" ? true : undefined}, 
            {name: "Themes", type: "themes", selected: current_cms_type == "themes" ? true : undefined}, 
        ],
        apipath: `${WEBSCROLLS_CONSTANTS.BACKEND}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`,
        appath: `${WEBSCROLLS_CONSTANTS.FRONTEND}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`,
        extrainfo: extraInfoEncoded
    };
}

function setcmstype(type) {session.set(CMSTYPE_KEY, type); router.hardreload();}

export const cms = {createdata, logout: loginmanager.logout, setcmstype};