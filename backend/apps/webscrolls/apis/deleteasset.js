/**
 * Deletes the given asset from the given URL.
 * 
 * Params
 * 	url: URL to delete
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");
const fspromises = require("fs").promises;

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for deleting asset ${jsonReq.url}.`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got delete asset request for path: " + jsonReq.url);

	try {
		const finalPath = path.resolve(WEBSCROLLS_CONSTANTS.FRONTEND_ROOT+"/"+new URL(jsonReq.url).pathname);
		await fspromises.rm(finalPath, {force: true});
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error deleting ${jsonReq.url} due to error: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.url && jsonReq.data);
