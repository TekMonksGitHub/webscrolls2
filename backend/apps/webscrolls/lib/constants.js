/* 
 * (C) 2015 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

const path = require("path");

exports.APP_ROOT = `${path.resolve(`${__dirname}/../`)}`;
exports.CONF_DIR = `${exports.APP_ROOT}/conf`
exports.FRONTEND_ROOT = `${path.resolve(`${exports.APP_ROOT}/../../../frontend/`)}`;
