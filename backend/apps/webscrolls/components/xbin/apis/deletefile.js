/**
 * Deletes the given file. 
 * (C) 2020 TekMonks. All rights reserved.
 */
const fs = require("fs");
const fspromises = fs.promises;
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const blackboard = require(`${CONSTANTS.LIBDIR}/blackboard.js`);
const db = require(`${XBIN_CONSTANTS.LIB_DIR}/xbindb.js`).getDB();
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);

exports.doService = async (jsonReq, _, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error("Validation failure."); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug("Got deletefile request for path: " + jsonReq.path);
	return exports.deleteFile(headers, jsonReq.path, jsonReq.extraInfo);
}

exports.deleteFile = async (headersOrIDAndOrg, cmsPath, extraInfo, noevent) => {
	const ip = utils.getLocalIPs()[0], id = headersOrIDAndOrg.xbin_id||cms.getID(headersOrIDAndOrg), 
		org = headersOrIDAndOrg.xbin_org||cms.getOrg(headersOrIDAndOrg);

	LOG.debug("Got delete file request for cms path: " + cmsPath + " for ID: " + id + " and org: " + org);

	const fullpath = await cms.getFullPath(headersOrIDAndOrg, cmsPath, extraInfo);
	if (!await cms.isSecure(headersOrIDAndOrg, fullpath, extraInfo)) {LOG.error(`Path security validation failure: ${fullpath}`); return CONSTANTS.FALSE_RESULT;}

	try {await fspromises.access(fullpath, fs.constants.W_OK | fs.constants.R_OK)} catch (err) {
		if (err.code == "ENOENT") return CONSTANTS.TRUE_RESULT;	// doesn't exist already
		else {LOG.error(`Unable to access ${fullpath} to delete.`); return CONSTANTS.FALSE_RESULT;}
	}
	try {await rmrf(fullpath, id, org, ip, extraInfo, noevent);} catch (err) {
		LOG.error(`Unable to delete ${fullpath} due to filesystem error ${err}.`); return CONSTANTS.FALSE_RESULT;
	}
	return CONSTANTS.TRUE_RESULT;
}

async function rmrf(path, id, org, ip, extraInfo, noevent) {
	const _deleteFile = async path => {
		await unlinkFileAndRemoveFromDB(path); 
		const cmspath = await cms.getCMSRootRelativePath({xbin_id: id, xbin_org: org}, path, extraInfo);
		if (!noevent) blackboard.publish(XBIN_CONSTANTS.XBINEVENT, {type: XBIN_CONSTANTS.EVENTS.FILE_DELETED, 
			path, id, org, ip, cmspath, isxbin: true, extraInfo});
	}

	if ((await fspromises.stat(path)).isFile()) { await _deleteFile(path); return; }

	const entries = (await fspromises.readdir(path)).filter(item=>!item.includes(XBIN_CONSTANTS.STATS_EXTENSION));
	for (const entry of entries) {
		const stats = await uploadfile.getFileStats(`${path}/${entry}`);
		if (stats.xbintype == XBIN_CONSTANTS.XBIN_FILE) await _deleteFile(`${path}/${entry}`); 
		else if (stats.xbintype == XBIN_CONSTANTS.XBIN_FOLDER) await rmrf(`${path}/${entry}`, id, org, ip, extraInfo, noevent);
	}
	await fspromises.rmdir(path); try {await uploadfile.deleteDiskFileMetadata(path);} catch (err) {};
}

async function unlinkFileAndRemoveFromDB(path) {
	await db.runCmd("DELETE FROM shares WHERE fullpath = ?", [path]);	
	await fspromises.unlink(path); try {await uploadfile.deleteDiskFileMetadata(path);} catch (err) {};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.path);

