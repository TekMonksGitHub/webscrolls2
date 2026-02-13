/**
 * Modifies settings. Should be hoisted at <app>/components/settings-editor
 * 
 * Params
 *  op: Can be read or update, if update then any of the following can be modified,
 *      if read then all of the following are returned.
 *  conf_file: The path to the conf file, relative to this component's root path
 *  encrypted_keys: If specified these keys are decrypted before processing or encrypted before writing
 *  encryption_key: The key whose value is the encryption key (must be part of the same config)
 * 
 * (C) 2025 TekMonks. All rights reserved.
 */

const path = require("path");
const yaml = require("yaml");
const fspromises = require("fs").promises;
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);

exports.doService = async (jsonReq, servObject) => {
	if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for publishing ${jsonReq.posturl}.`); return CONSTANTS.FALSE_RESULT;}
	
	LOG.debug(`Got settings request from client at ${servObject.env.remoteHost}`);

	try {
		const isYaml = jsonReq.conf_file.toLowerCase().endsWith("yaml"), parser = isYaml ? yaml : JSON;
		const confFilePath = path.resolve(`${__dirname}/../${jsonReq.conf_file}`);
		const conf = parser.parse(await fspromises.readFile(confFilePath, "utf8"));

		if (jsonReq.op == "read") {
			for (const key of (jsonReq.encrypted_keys||[])) conf[key] = 
				crypt.decrypt(conf[key], jsonReq.encryption_key?conf[jsonReq.encryption_key]:undefined);
			return {...conf, ...CONSTANTS.TRUE_RESULT};
		}
		
		if (jsonReq.op == "write") {
			for (const key of (jsonReq.encrypted_keys||[])) jsonReq[key] = 
				crypt.encrypt(jsonReq[key], jsonReq.encryption_key?conf[jsonReq.encryption_key]:undefined);
			const newConf = {...conf, ...jsonReq, op: undefined, conf_file: undefined, encrypted_keys: undefined, encryption_key: undefined};
			const newConfRaw = parser.stringify(newConf, isYaml?{lineWidth: 0}:undefined, isYaml?undefined:4);
			await fspromises.writeFile(confFilePath, newConfRaw, "utf8");
			return CONSTANTS.TRUE_RESULT;
		}
	} catch (err) {
		LOG.error(`Error operating on ${confFilePath} due to error: ${err}`); 
		return CONSTANTS.FALSE_RESULT;
	}
}

const validateRequest = jsonReq => (jsonReq && (jsonReq.op == "read" || jsonReq.op == "write"), jsonReq.conf_file);
