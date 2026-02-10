/**
 * Webscrolls app init.
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");

exports.initSync = function(_app, approot) {
    const APP_LIBDIR = `${approot}/lib`;
    global.WEBSCROLLS_CONSTANTS = require(`${APP_LIBDIR}/constants.js`);

    const xbin = require(`${WEBSCROLLS_CONSTANTS.APP_ROOT}/xbin/lib/xbin_init.js`)
    xbin.initSync();

    const cms = require(`${WEBSCROLLS_CONSTANTS.APP_ROOT}/xbin/lib/cms.js`)
    cms.addCMSPathModifier(async (_cmsroot, _id, _org, extraInfo) => { 
        let finalPath; 
        if (extraInfo.cmstype == "cms") finalPath = path.resolve(`${WEBSCROLLS_CONSTANTS.FRONTEND_ROOT}/${extraInfo.apppath}/cms`);
        else if (extraInfo.cmstype == "themes") finalPath = path.resolve(`${WEBSCROLLS_CONSTANTS.FRONTEND_ROOT}/${extraInfo.apppath}/themes`);
        else finalPath = path.resolve(`${WEBSCROLLS_CONSTANTS.FRONTEND_ROOT}/${extraInfo.apppath}/cms`);
        return finalPath;
    });
}