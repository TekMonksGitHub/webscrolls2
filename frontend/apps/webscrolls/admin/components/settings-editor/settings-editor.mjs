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

const COMPONENT_PATH = util.getModulePath(import.meta);

async function elementConnected(host) {
	const apiurl = host.getAttribute("apiurl"), conf_file = host.getAttribute("conffile");
	const encrypted_keys = host.getAttribute("encryptedkeys")?host.getAttribute("encryptedkeys").split(",") : undefined;
	const encryption_key = host.getAttribute("encryptionkey");

	const currentConfig = await apiman.rest(apiurl, "POST", {conf_file, encrypted_keys, encryption_key, op: "read"}, true);
	if (!currentConfig?.result) return {};
	const schema = []; for (const [key, value] of Object.entries(currentConfig)) {
		if (key == "result") continue;
		const keyName = key.split(/[-_]+/).map(entry => entry[0].toUpperCase()+entry.substring(1)).join(" ");
		const type = value.length > 50 ? "textarea" : "input";
		schema.push({name: keyName, key, type, value, textarea: type=="textarea"?true:undefined});
	}
	const memory = settings_editor.getMemoryByHost(host), memory_needed = {current_schema: schema, apiurl, conf_file, encrypted_keys, encryption_key};
	for (const [key, value] of Object.entries(memory_needed)) memory[key] = value;

	const data = {schema}; settings_editor.setData(host.id, data);
}

async function update(hostid) {
	const shadowRoot = settings_editor.getShadowRootByHostId(hostid), memory = settings_editor.getMemory(hostid);

	const config = {}; for (const configElement of memory.current_schema) {
		const valueElement = shadowRoot.querySelector(`#value${configElement.key}`);
		config[configElement.key] = valueElement?.value.trim().replace(/\r\n/g, '\n') || configElement.value;
	}
	const result = await apiman.rest(memory.apiurl, "POST", 
		{conf_file: memory.conf_file, encrypted_keys: memory.encrypted_keys, encryption_key: memory.encryption_key, 
			op: "write", ...config}, true);
	return result.result;
}

export const settings_editor = {trueWebComponentMode: true, elementConnected, update}
monkshu_component.register("settings-editor", `${COMPONENT_PATH}/settings-editor.html`, settings_editor);