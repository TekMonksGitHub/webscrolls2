/**
 * Settings page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {loginmanager} from "../../js/loginmanager.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const API_SETTINGS = `${WEBSCROLLS_CONSTANTS.API_PATH}/settings`;

async function createdata() {
    const currentConfig = await apiman.rest(API_SETTINGS, "POST", {op: "read"}, true);
    if (currentConfig.result) return {...currentConfig}; else return {};
}

async function update() {
    const ai_key = document.querySelector("textarea#valueaikey").value.trim().replace(/\r\n/g, '\n');
    const model = document.querySelector("input#valuemodel").value.trim();
    const systemprompt_theme = document.querySelector("textarea#valuethemeprompt").value.trim().replace(/\r\n/g, '\n');
    const systemprompt_post = document.querySelector("textarea#valuepostprompt").value.trim().replace(/\r\n/g, '\n');
    const result = await apiman.rest(API_SETTINGS, "POST", 
        {op: "write", ai_key, model, systemprompt_theme, systemprompt_post}, true);
    if (result.result) alert("Settings have been updated."); else alert("Sorry, update failed.")
}

export const settings = {createdata, update, logout: loginmanager.logout}