/**
 * Deletes the given post from the given URL.
 * 
 * Params
 * 	posturl: URL to delete
 *  postname: Optional: Post name, if not given then filename is assumed to be the post name
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");
const fspromises = require("fs").promises;
const serverutils = require(`${CONSTANTS.LIBDIR}/utils.js`);

exports.doService = async jsonReq => {
	if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for publishing ${jsonReq.posturl}.`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got publish request for path: " + jsonReq.posturl);

	try {
		const finalPath = path.resolve(WEBSCROLLS_CONSTANTS.FRONTEND_ROOT+"/"+new URL(jsonReq.posturl).pathname);
		const parentPostPath = path.dirname(finalPath);
		if (!(await serverutils.exists(parentPostPath))) return;	// this post doesn't exist already

		const postname = jsonReq.postname || path.basename(finalPath).split(".")[0];
		let posts = JSON.parse(await fspromises.readFile(`${parentPostPath}/posts.json`, "utf8"));
		posts.splice(posts.indexOf(postname), 1);	// delete this post from the posts array
		const postsJSON = JSON.stringify(posts, null, 2);
		await fspromises.writeFile(`${parentPostPath}/posts.json`, postsJSON, "utf8");
		await fspromises.rm(finalPath, {force: true});
		return CONSTANTS.TRUE_RESULT;
	} catch (err) {LOG.error(`Error writing to ${jsonReq.posturl} due to error: ${err}`); return CONSTANTS.FALSE_RESULT;}
}

const validateRequest = jsonReq => (jsonReq && jsonReq.posturl);
