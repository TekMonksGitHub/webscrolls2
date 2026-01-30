/**
 * Webscrolls app init.
 * (C) 2025 TekMonks. All rights reserved.
 */

exports.initSync = function(_app, approot) {
    const APP_LIBDIR = `${approot}/lib`;
    global.WEBSCROLLS_CONSTANTS = require(`${APP_LIBDIR}/constants.js`);
}