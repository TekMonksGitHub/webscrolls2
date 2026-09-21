/** 
 * Settings editor component. Backend assume the config file is in the 
 * relative path provided to the conf_file parameter. The config file 
 * can be a flat JSON or YAML file (no arrays).
 * 
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

import {util} from "/framework/js/util.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";
import {default as jsYaml} from "../../../3p/js-yaml.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

async function elementConnected(host) {
	const apiurl = host.getAttribute("apiurl"), conf_file = host.getAttribute("conffile");
	const dataformat = host.getAttribute("dataformat");
	const encrypted_keys = host.getAttribute("encryptedkeys")?host.getAttribute("encryptedkeys").split(",") : undefined;
	const encryption_key = host.getAttribute("encryptionkey");

	const currentConfig = dataformat ? await _fileRead(apiurl, conf_file, dataformat) :
		await apiman.rest(apiurl, "POST", {conf_file, encrypted_keys, encryption_key, op: "read"}, true);
	if (!currentConfig?.result) return {};
	const schema = []; for (const [key, value] of Object.entries(currentConfig)) {
		if (key == "result") continue;
		const keyName = key.split(/[-_]+/).map(entry => entry[0].toUpperCase()+entry.substring(1)).join(" ");
		const nested = Array.isArray(value) || (value && typeof value == "object");
		const displayValue = nested ? jsYaml.dump(value, {lineWidth: -1}) : value;
		const textarea = nested || (displayValue.length > 50);
		schema.push({name: keyName, key, value: displayValue, textarea: textarea||undefined, nested: nested||undefined});
	}
	const memory = settings_editor.getMemoryByHost(host), memory_needed = {current_schema: schema, apiurl, conf_file, dataformat, encrypted_keys, encryption_key};
	for (const [key, value] of Object.entries(memory_needed)) memory[key] = value;

	const data = {schema}; settings_editor.setData(host.id, data);
}

async function update(hostid) {
	const shadowRoot = settings_editor.getShadowRootByHostId(hostid), memory = settings_editor.getMemory(hostid);

	const config = {}; for (const configElement of memory.current_schema) {
		const valueElement = shadowRoot.querySelector(`#value${configElement.key}`);
		const rawValue = valueElement?.value.trim().replace(/\r\n/g, '\n') || configElement.value;
		config[configElement.key] = configElement.nested ? jsYaml.load(rawValue) : rawValue;
	}

	if (memory.dataformat) return await _fileWrite(memory.apiurl, memory.conf_file, memory.dataformat, config);

	const result = await apiman.rest(memory.apiurl, "POST",
		{conf_file: memory.conf_file, encrypted_keys: memory.encrypted_keys, encryption_key: memory.encryption_key, 
			op: "write", ...config}, true);
	return result.result;
}

async function _fileRead(apiurl, path, dataformat) {
	const result = await apiman.rest(apiurl, "POST", {path, op: "read"}, true);
	if (!result?.result) return undefined;
	const config = dataformat == "json" ? JSON.parse(result.data) : jsYaml.load(result.data);
	return {...config, result: true};
}

async function _fileWrite(apiurl, path, dataformat, config) {
	const data = dataformat == "json" ? JSON.stringify(config, null, 4) : jsYaml.dump(config, {lineWidth: -1});
	const result = await apiman.rest(apiurl, "POST", {path, op: "write", data}, true);
	return result.result;
}

export const settings_editor = {trueWebComponentMode: true, elementConnected, update}
monkshu_component.register("settings-editor", `${COMPONENT_PATH}/settings-editor.html`, settings_editor);