/**
 * Publishes the given post to the given URL.
 * 
 * Params
 * 	postdata: Post in JSON object format
 * 	posturl: URL to publish to
 *  postname: Optional: Post name, if not given then filename is assumed to be the post name
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const yaml = require("yaml");
const path = require("path");
const fspromises = require("fs").promises;
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for publishing ${jsonReq.posturl}.`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got publish request for path: " + jsonReq.posturl);

	try {
		const finalPath = path.resolve(WEBSCROLLS_CONSTANTS.FRONTEND_ROOT+"/"+new URL(jsonReq.posturl).pathname);
		const parentPostPath = path.dirname(finalPath);
		if (!await _initPostPath(parentPostPath)) {LOG.error(`Path init failed for ${parentPostPath}`); return CONSTANTS.FALSE_RESULT;}

		const yamlStr = yaml.stringify(jsonReq.postdata);
		const postname = jsonReq.postname || path.basename(finalPath).split(".")[0];
		let posts = JSON.parse(await fspromises.readFile(`${parentPostPath}/posts.json`, "utf8"));
		posts = [...(new Set(posts).add(postname))];	// remove duplicates in case of edits to an existing post
		const postsJSON = JSON.stringify(posts, null, 2);
		await fspromises.writeFile(finalPath, yamlStr, "utf8"); 
		await fspromises.writeFile(`${parentPostPath}/posts.json`, postsJSON, "utf8");
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error writing to ${jsonReq.posturl} due to error: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

async function _initPostPath(path) {
	if (await serverutils.exists(path)) return true;
	try {await fspromises.mkdir(path, {recursive: true});} catch (err) {LOG.error(`Error creating posts directory ${path}. Error: ${err}`); return false;}
	try {await fspromises.writeFile(`${path}/posts.json`, "[]", "utf8");}
	catch (err) {LOG.error(`Error creating posts.json file in path ${path}. Error: ${err}`); return false;}
	return true;
}

const validateRequest = jsonReq => (jsonReq && jsonReq.posturl && jsonReq.postdata);
