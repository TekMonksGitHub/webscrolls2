/**
 * Adds the given asset to the given URL.
 * 
 * Params
 * 	data: Data in base 64 
 * 	url: URL to add to
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");
const fspromises = require("fs").promises;
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for adding asset ${jsonReq.url}.`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got add asset request for path: " + jsonReq.url);

	try {
		const finalPath = path.resolve(WEBSCROLLS_CONSTANTS.FRONTEND_ROOT+"/"+new URL(jsonReq.url).pathname);
		const parentPath = path.dirname(finalPath);
		_initPath(parentPath);

		const data = Buffer.from(jsonReq.data, "base64");
		await fspromises.writeFile(finalPath, data);
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error writing to ${jsonReq.url} due to error: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

async function _initPath(path) {
	if (await serverutils.exists(path)) return;
	try {await fspromises.mkdir(path, {recursive: true});} catch (err) {LOG.error(`Error creating assets directory ${path}. Error: ${err}`); return false;}
	return true;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.url && jsonReq.data);
