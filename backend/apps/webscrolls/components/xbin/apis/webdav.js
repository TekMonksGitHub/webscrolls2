/**
 * webdav.js
 * Translates WebDAV requests, sent by the drive-mounter client, into calls on
 * Xbin's existing file APIs.
 * Verbs: PROPFIND, GET, PUT, MKCOL, DELETE, MOVE, COPY - the full set client sends for vendor
 */
const cms = require(`${XBIN_CONSTANTS.LIB_DIR}/cms.js`);
const quotas = require(`${XBIN_CONSTANTS.LIB_DIR}/quotas.js`);
const getfiles = require(`${XBIN_CONSTANTS.API_DIR}/getfiles.js`);
const uploadfile = require(`${XBIN_CONSTANTS.API_DIR}/uploadfile.js`);
const downloadfile = require(`${XBIN_CONSTANTS.API_DIR}/downloadfile.js`);
const createfile = require(`${XBIN_CONSTANTS.API_DIR}/createfile.js`);
const deletefile = require(`${XBIN_CONSTANTS.API_DIR}/deletefile.js`);
const renamefile = require(`${XBIN_CONSTANTS.API_DIR}/renamefile.js`);
const copyfile = require(`${XBIN_CONSTANTS.API_DIR}/copyfile.js`);

exports.handleRawRequest = async function(rawBody, servObject, headers, url, apiconf) {
	const req = servObject.req, res = servObject.res;
	const webdavPrefix = apiconf.route; // the route this file is registered under, e.g. "/apps/xbin/webdav"
	const davPath = _getDavPath(url, webdavPrefix);
	if (!cms.getID(headers)) { res.writeHead(401); res.end(); return; }

	try {
		if (req.method === "PROPFIND") await _handlePropfind(davPath, headers, headers.depth, res, webdavPrefix);
		else if (req.method === "GET") await _handleGet(servObject, headers, url, davPath);
		else if (req.method === "PUT") await _handlePut(rawBody, davPath, headers, res);
		else if (req.method === "MKCOL") await _handleMkcol(davPath, headers, res);
		else if (req.method === "DELETE") await _handleDelete(davPath, headers, res);
		else if (req.method === "MOVE") await _handleMove(davPath, headers, res, webdavPrefix);
		else if (req.method === "COPY") await _handleCopy(davPath, headers, res, webdavPrefix);
		else { res.writeHead(405); res.end(); }
	} catch (err) {
		LOG.error(`webdav.js: error handling ${req.method} ${davPath}: ${err}`);
		res.writeHead(500); res.end();
	}
}

/** Strips the registered prefix off the incoming URL, leaving the CMS-relative path. */
function _getDavPath(url, webdavPrefix) {
	const pathname = new URL(url).pathname;
	const rest = pathname.slice(webdavPrefix.length);
	return rest === "" ? "/" : decodeURIComponent(rest);
}

/** For the "Destination" header MOVE/COPY carry the target path in. */
function _getDavPathFromDestinationHeader(headers, webdavPrefix) {
	const afterPrefix = headers.destination.split(webdavPrefix)[1] || "";
	return afterPrefix === "" ? "/" : decodeURIComponent(afterPrefix);
}

/** Answers a WebDAV PROPFIND: describes davPath itself, plus its children unless Depth: 0
 * (Depth: 0 means "just this path, not what's inside it" - used to stat one resource). */
async function _handlePropfind(davPath, headers, depthHeader, res, webdavPrefix) {
	const fullpath = await cms.getFullPath(headers, davPath);
	let targetStats; try { targetStats = await uploadfile.getFileStats(fullpath); }
	catch (err) { res.writeHead(404); res.end(); return; }

	const isDir = targetStats.xbintype === "directory";
	const listChildren = isDir && depthHeader !== "0";
	const quota = (davPath === "/") ? await _getQuota(headers) : null;
	const selfEntry = _toResponseXml(_toHref(davPath, webdavPrefix), isDir, targetStats.size || 0, quota);

	let childEntries = "";
	if (listChildren) {
		const listResult = await getfiles.doService({ path: davPath, genStatsIfNeeded: true }, null, headers);
		if (listResult.result) childEntries = listResult.entries
			.map(entry => _toResponseXml(_toHref(entry.path, webdavPrefix), entry.stats.xbintype === "directory", entry.stats.size || 0))
			.join("");
	}

	res.writeHead(207, { "Content-Type": "application/xml; charset=utf-8" });
	res.end(`<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${selfEntry}${childEntries}</D:multistatus>`);
}

/** Checks quota without enforcing it */
async function _getQuota(headers) {
	const result = await quotas.checkQuota(headers, undefined, 0);
	return { usedBytes: result.currentsize || 0, availableBytes: Math.max(0, (result.quota || 0) - (result.currentsize || 0)) };
}

const _toHref = (davPath, webdavPrefix) => `${webdavPrefix}${davPath}`.replace(/\/+/g, "/");

function _toResponseXml(href, isDir, sizeBytes, quota) {
	const quotaXml = quota
		? `<D:quota-used-bytes>${quota.usedBytes}</D:quota-used-bytes><D:quota-available-bytes>${quota.availableBytes}</D:quota-available-bytes>`
		: "";
	return `<D:response><D:href>${href}</D:href><D:propstat><D:prop>` +
		`<D:resourcetype>${isDir ? "<D:collection/>" : ""}</D:resourcetype>` +
		`<D:getcontentlength>${sizeBytes}</D:getcontentlength>${quotaXml}` +
		`</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
}

/** Streams a file's bytes back to the client. */
async function _handleGet(servObject, headers, url, davPath) {
	const fullpath = await cms.getFullPath(headers, davPath);
	if (!await cms.isSecure(headers, fullpath)) { servObject.res.writeHead(403); servObject.res.end(); return; }

	await downloadfile.downloadFile({ fullpath, reqid: Date.now() }, servObject, headers, url);
}

/** Saves a file's content. rawBody is already a full Buffer, not a stream. */
async function _handlePut(rawBody, davPath, headers, res) {
	const fileBytes = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "");
	const uploadResult = await uploadfile.uploadFile(cms.getID(headers), cms.getOrg(headers), fileBytes, davPath);
	res.writeHead(uploadResult.result ? 201 : 500);
	res.end();
}

/** Creates a new folder. */
async function _handleMkcol(davPath, headers, res) {
	const createResult = await createfile.doService({ path: davPath, isDirectory: true }, null, headers);
	res.writeHead(createResult.result ? 201 : 409);
	res.end();
}

/** Deletes a file or folder. */
async function _handleDelete(davPath, headers, res) {
	const deleteResult = await deletefile.deleteFile(headers, davPath);
	res.writeHead(deleteResult.result ? 204 : 404);
	res.end();
}

/** Renames/moves a file or folder. */
async function _handleMove(davPath, headers, res, webdavPrefix) {
	const newDavPath = _getDavPathFromDestinationHeader(headers, webdavPrefix);
	const renameResult = await renamefile.renameFile(headers, davPath, newDavPath);
	res.writeHead(renameResult.result ? 201 : 409);
	res.end();
}

/** Copies a file or folder. */
async function _handleCopy(davPath, headers, res, webdavPrefix) {
	const newDavPath = _getDavPathFromDestinationHeader(headers, webdavPrefix);
	const copyResult = await copyfile.doService({ from: davPath, to: newDavPath }, null, headers);
	res.writeHead(copyResult.result ? 201 : 409);
	res.end();
}
