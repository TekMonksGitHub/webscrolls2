/**
 * Modifies settings.
 * 
 * Params
 *  op: Can be read or update, if update then any of the following can be modified,
 *      if read then all of the following are returned.
 * 	ai_key: AI Key
 * 	model: AI Model
 *  systemprompt_theme: The theme prompt
 *  systemprompt_post: The post prompt
 * 
 * (C) 2025 TekMonks. All rights reserved.
 */

const yaml = require("yaml");
const fspromises = require("fs").promises;
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);
const login = require(`${WEBSCROLLS_CONSTANTS.API_DIR}/login.js`);

exports.doService = async (jsonReq, servObject, headers) => {
	if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for publishing ${jsonReq.posturl}.`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug(`Got settings request from ID: ${login.getID(headers)} at ${servObject.env.remoteHost}`);

	try {
		const aiconf = yaml.parse(await fspromises.readFile(`${WEBSCROLLS_CONSTANTS.CONF_DIR}/ai.yaml`, "utf8"));

		if (jsonReq.op == "read") return {
			ai_key: crypt.decrypt(aiconf.ai_key, aiconf.crypt_key),
			model: aiconf.model,
			systemprompt_theme: aiconf.systemprompt_theme,
			systemprompt_post: aiconf.systemprompt_post,
			...CONSTANTS.TRUE_RESULT
		}
		
		if (jsonReq.op == "write") {
			const newAIKey = jsonReq.ai_key ? crypt.encrypt(jsonReq.ai_key, aiconf.crypt_key) : aiconf.ai_key;
			const newAIConf = {...aiconf, ...jsonReq, op: undefined, ai_key: newAIKey};
			const newAIConfRaw = yaml.stringify(newAIConf, {lineWidth: 0});
			await fspromises.writeFile(`${WEBSCROLLS_CONSTANTS.CONF_DIR}/ai.yaml`, newAIConfRaw, "utf8");
			return CONSTANTS.TRUE_RESULT;
		}
	} catch (err) {
		LOG.error(`Error operating on ${WEBSCROLLS_CONSTANTS.CONF_DIR}/ai.yaml due to error: ${err}`); 
		return CONSTANTS.FALSE_RESULT;
	}
}


const validateRequest = jsonReq => (jsonReq && (jsonReq.op == "read" || jsonReq.op == "write"));
