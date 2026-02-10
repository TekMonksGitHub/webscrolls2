/**
 * Main entry point. Parses and routes to the page.
 * 
 * URL format: https://host:port/apps/webscrolls/theme/page.html?p=postid
 *  
 * (C) 2015 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {loginmanager} from "./loginmanager.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {default as jsYaml} from "../3p/js-yaml.mjs";
import {securityguard} from "/framework/js/securityguard.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const init = async _hostname => {
	$$.MONKSHU_CONSTANTS.setDebugLevel($$.MONKSHU_CONSTANTS.DEBUG_LEVELS.refreshOnReload);	// remove for PROD

	window.WEBSCROLLS_CONSTANTS = (await import ("./constants.mjs")).WEBSCROLLS_CONSTANTS;
	window.WEBSCROLLS_LOG = $$.LOG;
	window.monkshu_env.apps[WEBSCROLLS_CONSTANTS.APP_NAME] = {main};
	if (!session.get($$.MONKSHU_CONSTANTS.LANG_ID)) session.set($$.MONKSHU_CONSTANTS.LANG_ID, "en");
	securityguard.setPermissionsMap(WEBSCROLLS_CONSTANTS.PERMISSIONS_MAP);
	securityguard.setCurrentRole(securityguard.getCurrentRole() || WEBSCROLLS_CONSTANTS.GUEST_ROLE);
	apiman.registerAPIKeys(WEBSCROLLS_CONSTANTS.API_KEYS, WEBSCROLLS_CONSTANTS.API_KEY_HEADER); 
}

const main = async urlRequested => {
	let {url, posturl, isadmin, module, theme} = _getURLAndPostToRouteTo(urlRequested), pushstate = url != window.location.href;

	let postdata = {}; try {
		if (posturl) postdata = jsYaml.load(await $$.requireText(posturl));
		if (isadmin) {
			if (!loginmanager.isUserLoggedIn()) {
				session.set(WEBSCROLLS_CONSTANTS.POST_LOGIN_URL_KEY, url);
				url = WEBSCROLLS_CONSTANTS.LOGIN_HTML; postdata = {};
			} else {
				const pageModule = (await import(`./../${theme}/${module}.mjs`))[module];
				postdata = await pageModule.createdata();
			}
		}
	} catch (err) {WEBSCROLLS_LOG.error(`Bad post, ${posturl}, error fetching: ${err}`);}

	try {await router.loadPage(url, {WEBSCROLLS_CONSTANTS, ...postdata}, true, pushstate);} catch (error) { 
		router.loadPage(WEBSCROLLS_CONSTANTS.ERROR_HTML, {WEBSCROLLS_CONSTANTS, error, stack: error.stack || new Error().stack}); }
}

function _getURLAndPostToRouteTo(urlRequested) {
	const {adminurl, loginurl, protocol, host, theme, page, postid, search, hash} = _decodePageURL(urlRequested);
	if (adminurl) return {url: adminurl, module: page, isadmin: true, theme: "admin"};
	if (loginurl) return {url: loginurl, module: page, isadmin: false, theme: ""};

	let urlToRouteTo = `${protocol}//${host}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}/themes/${theme}/${page}`;
	const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
	const posturl = `${protocol}//${host}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}/cms/${page.split(".")[0]}/${postid||"default"}.${lang}.yaml`;
	if (search) urlToRouteTo += search; if (hash) urlToRouteTo += hash;
	return {url: urlToRouteTo, posturl, theme, page, postid, isadmin: false};
}

function _decodePageURL(urlRequested=window.location) {
	let page = "home.html", theme = "default", postid = undefined, search = urlRequested.search;
	const protocol = urlRequested.protocol, host = urlRequested.host, hash = urlRequested.hash;
	let pathname = urlRequested.pathname; if (!pathname.startsWith("/")) pathname = "/" + pathname;
	const pathParts = pathname.split("/").slice(3);	// takes out apps/appname
	if (pathParts[0] == "admin") return {adminurl: urlRequested.pathname, page: urlRequested.pathname.split("/").at(-1).split(".")[0]};
	if ((pathParts[0] == "login.html" || pathParts[0] == "loginresult.html")) return {loginurl: urlRequested.href, page: urlRequested.pathname.split("/").at(-1).split(".")[0]};

	let currentPathPartDepth = -1; for (const pathPart of pathParts) {
		currentPathPartDepth++;
		if (pathPart.toLowerCase().endsWith(".html")) {
			if (pathPart.toLowerCase() != "index.html" && pathPart.toLowerCase() != "home.html") page = pathPart;
			if (currentPathPartDepth > 0) theme = pathParts[currentPathPartDepth-1];
			break;
		}
	}
	if (search) for (const searchparamtuple of search.substring(1).split("&"))
		if (searchparamtuple.startsWith("p=")) postid = searchparamtuple.split("=")[1]; 
	return {protocol, host, theme, page, postid, search, hash};
}

export const application = {init, main};