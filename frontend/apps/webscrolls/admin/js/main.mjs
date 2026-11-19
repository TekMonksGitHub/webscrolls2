/**
 * Main page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {permissions} from "./permissions.mjs";

async function createdata() {
    const broadPermissions = permissions.getCurrentUsersBroadPermissions();

    const retObject = {};
    if (broadPermissions.hasSitePermissions) retObject.showthemes = true;
    if (broadPermissions.hasThemePermissions) retObject.showthemes = true;
    if (broadPermissions.hasPostPermissions) retObject.showposts = true;
    if (broadPermissions.hasCMSPermissions) retObject.showcms = true;
    if (broadPermissions.hasSitePermissionsModificationPermissions) retObject.showpermissions = true;
    if (broadPermissions.hasSiteSettingsPermissions) retObject.showsettings = true;

    return retObject;
}

export const main = {createdata}