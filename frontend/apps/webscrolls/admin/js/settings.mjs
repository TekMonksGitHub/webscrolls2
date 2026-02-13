/**
 * Settings page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {loginmanager} from "../../js/loginmanager.mjs";

const API_SETTINGS = `${WEBSCROLLS_CONSTANTS.API_PATH}/settingseditor`;
const CONF_FILE = "./../../conf/ai.yaml";

function createdata() {return {apisettings: API_SETTINGS, conffile: CONF_FILE, encryptedkeys:"ai_key", encryptionkey: "crypt_key"};}

async function update(editor_id) {
    const settings_editor = window.monkshu_env.components["settings-editor"];
    const result = await settings_editor.update(editor_id);
    if (result) alert("Settings have been updated."); else alert("Sorry, update failed.")
}

export const settings = {createdata, update, logout: loginmanager.logout}