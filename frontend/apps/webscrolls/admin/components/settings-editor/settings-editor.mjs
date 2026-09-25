/**
 * Settings editor component for flat or nested JSON/YAML config files. With a
 * dataformat="yaml"|"json" attribute, it uses a generic raw-file API instead of
 * Webscrolls2's settingseditor API. An optional schemafile can provide the explicit
 * field-schema format; otherwise the form schema is inferred from the config.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 */

import {util} from "/framework/js/util.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";
import {router} from "/framework/js/router.mjs";
import {default as jsYaml} from "../../../3p/js-yaml.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);
const MUSTACHE = await router.getMustache();

async function elementConnected(host) {
	const apiurl = host.getAttribute("apiurl"), conf_file = host.getAttribute("conffile");
	const dataformat = host.getAttribute("dataformat"), schema_file = host.getAttribute("schemafile"),
		schema_format = host.getAttribute("schemaformat") || dataformat || "json";
	const encrypted_keys = host.getAttribute("encryptedkeys")?host.getAttribute("encryptedkeys").split(",") : undefined;
	const encryption_key = host.getAttribute("encryptionkey");

	const currentConfig = dataformat ? await _fileRead(apiurl, conf_file, dataformat) :
		await apiman.rest(apiurl, "POST", {conf_file, encrypted_keys, encryption_key, op: "read"}, true);
	if (!currentConfig?.result) return {};
	const config = {...currentConfig}; delete config.result;
	let schema;
	if (schema_file) {
		const schemaConfig = await _fileRead(apiurl, schema_file, schema_format);
		if (schemaConfig?.result) {schema = {...schemaConfig}; delete schema.result;}
	}

	Object.assign(settings_editor.getMemoryByHost(host), {config, schema, apiurl, conf_file, dataformat, encrypted_keys, encryption_key});
}

async function elementRendered(host) {
	const shadowRoot = settings_editor.getShadowRootByHost(host), memory = settings_editor.getMemoryByHost(host);

	const templateHTML = util.unescapeHTML(shadowRoot.querySelector("template#fieldtemplate").innerHTML);
	const partials = {fieldtemplatepartial: templateHTML};
	const templatedata = memory.schema ? _parseSchemaIntoTemplateData(memory.schema) : _parseConfigIntoSchema(memory.config);
	const divSettings = shadowRoot.querySelector("div#settings");
	divSettings.innerHTML = MUSTACHE.render(templateHTML, templatedata, partials);

	_renderConfigItems(divSettings, memory.config);
}

async function update(hostid) {
	const shadowRoot = settings_editor.getShadowRootByHostId(hostid), memory = settings_editor.getMemory(hostid);

	const config = {}; for (const divField of shadowRoot.querySelectorAll("div#settings > div.settingsfields")) {
		const fieldObject = _extractFieldValue(divField), key = Object.keys(fieldObject)[0];
		config[key] = fieldObject[key];
	}

	if (memory.dataformat) return await _fileWrite(memory.apiurl, memory.conf_file, memory.dataformat, config);

	const result = await apiman.rest(memory.apiurl, "POST",
		{conf_file: memory.conf_file, encrypted_keys: memory.encrypted_keys, encryption_key: memory.encryption_key,
			op: "write", ...config}, true);
	return result.result;
}

/* Fills divArrayFields with itemValue if first, else clones it as a new sibling and fills the clone. */
function addArrayItem(divArrayFields, itemValue, isFirstFieldValue) {
	isFirstFieldValue ||= divArrayFields.dataset.placeholder == "true";
	const newDiv = isFirstFieldValue ? divArrayFields : divArrayFields.cloneNode(true);
	newDiv.dataset.placeholder = "false";
	newDiv.id = isFirstFieldValue ? newDiv.id : divArrayFields.id+Date.now(); _emptyFieldValues(newDiv);
	if (!isFirstFieldValue) {
		newDiv.querySelector("span.arraycarddelete").classList.remove("displaynone");
		divArrayFields.parentNode.appendChild(newDiv);
	} else for (const childNode of divArrayFields.parentNode.querySelectorAll(":scope > div.nestedfields.arrayitem"))
		if (childNode !== newDiv) divArrayFields.parentNode.removeChild(childNode); // delete all other current nodes

	if (itemValue === undefined) return;   // "+" button click, leave the new card blank
	const isArray = Array.isArray(itemValue), isObject = (!isArray) && itemValue && typeof itemValue == "object";
	if (isArray || isObject) _renderConfigItems(newDiv, itemValue);
	else {
		const itemInput = newDiv.querySelector(":scope > span.itemvalue input, :scope > span.itemvalue textarea");
		if (itemInput) itemInput.value = itemValue;
	}
}

function deleteArrayItem(divArrayFields) {
	divArrayFields.parentNode.removeChild(divArrayFields);
}

const _emptyFieldValues = rootNode => {
	for (const inputType of ["input", "textarea"]) for (const input of rootNode.querySelectorAll(inputType)) input.value = "";
}

/* Populates the initial structure-only render with real data. */
function _renderConfigItems(rootNode, config) {
	for (const [key, value] of Object.entries(config)) {
		const id = _sanitizeId(key);
		const isArray = Array.isArray(value), isObject = (!isArray) && value && typeof value == "object";
		if (isArray) {
			const divArrayFields = rootNode.querySelector(`:scope > div.settingsfields > span.fieldvalue > div.nestedfields#arrayfields${id}`);
			if (divArrayFields && value.length == 0) divArrayFields.dataset.placeholder = "true";
			else if (divArrayFields) for (let i = 0; i < value.length; i++) addArrayItem(divArrayFields, value[i], i==0);
		} else if (isObject) {
			const divObjectFields = rootNode.querySelector(`:scope > div.settingsfields > span.fieldvalue > div.nestedfields#objectfields${id}`);
			if (divObjectFields) _renderConfigItems(divObjectFields, value);
		} else {
			const input = rootNode.querySelector(`:scope > div.settingsfields > span.fieldvalue #value${id}`);
			if (input) input.value = value;
		}
	}
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

/* id is a DOM-safe stand-in for key (which may contain characters CSS ids can't use, e.g. "."). */
const _sanitizeId = key => key.replace(/[^a-zA-Z0-9_-]/g, "_");

function _parseConfigIntoSchema(config) {
	const templatedata = {schema: []}; for (const [key, value] of Object.entries(config)) {
		const name = key.split(/[-_]+/).map(entry => entry[0].toUpperCase()+entry.substring(1)).join(" ");
		const isArray = Array.isArray(value), isObject = (!isArray) && value && typeof value == "object";

		let schema, itemisvalue, itemtextarea;
		if (isArray) {
			const firstItem = value.length ? value[0] : "";
			itemisvalue = (!Array.isArray(firstItem)) && (!firstItem || typeof firstItem != "object");
			if (itemisvalue) itemtextarea = (typeof firstItem == "string") && (firstItem.length > 50);
			else schema = _parseConfigIntoSchema(firstItem).schema;
		} else if (isObject) schema = _parseConfigIntoSchema(value).schema;

		const textarea = (typeof value == "string") && (value.length > 50);
		templatedata.schema.push({name, id: _sanitizeId(key), key, schema, itemisvalue: itemisvalue||undefined, itemtextarea: itemtextarea||undefined,
			array: isArray||undefined, object: isObject||undefined, textarea: textarea||undefined});
	}
	return templatedata;
}

/* Parses the explicit field/type and field-schema format */
function _parseSchemaIntoTemplateData(schema) {
	const templatedata = {schema: []}; for (const [key, value] of Object.entries(schema)) {
		if (key.endsWith("-schema")) continue;
		const isArray = value == "array", childSchema = isArray ? schema[`${key}-schema`] : undefined;
		templatedata.schema.push({name: key.split(/[-_]+/).map(entry => entry[0].toUpperCase()+entry.substring(1)).join(" "),
			id: _sanitizeId(key), key, schema: childSchema ? _parseSchemaIntoTemplateData(childSchema).schema : undefined,
			itemisvalue: isArray && !childSchema ? true : undefined, array: isArray||undefined, textarea: value == "textarea"||undefined});
	}
	return templatedata;
}

/* Reads the DOM tree back into a nested config object. */

function _extractFieldValue(divField) {
	const spanName = divField.querySelector(":scope > span.fieldname");
	const id = spanName.id.substring(8), key = spanName.dataset.key;   // "spanname" prefix; id is DOM-sanitized, key is the real config key
	const spanFieldvalue = divField.querySelector(":scope > span.fieldvalue");
	const isArray = spanFieldvalue.dataset.array == "true";

	let value;
	if (isArray) {
		value = []; const divArrayItems = spanFieldvalue.querySelectorAll(":scope > div.nestedfields.arrayitem");
		for (const divArrayItem of divArrayItems) {
			if (divArrayItem.dataset.placeholder == "true") continue;
			const itemInput = divArrayItem.querySelector(":scope > span.itemvalue input, :scope > span.itemvalue textarea");
			if (itemInput) value.push(itemInput.value);
			else {
				const itemObject = {}; for (const divItemField of divArrayItem.querySelectorAll(":scope > div.settingsfields")) {
					const childObject = _extractFieldValue(divItemField), childKey = Object.keys(childObject)[0];
					itemObject[childKey] = childObject[childKey];
				}
				value.push(itemObject);
			}
		}
	} else {
		const divObjectFields = spanFieldvalue.querySelector(`:scope > div.nestedfields#objectfields${id}`);
		if (divObjectFields) {
			value = {}; for (const divChildField of divObjectFields.querySelectorAll(":scope > div.settingsfields")) {
				const childObject = _extractFieldValue(divChildField), childKey = Object.keys(childObject)[0];
				value[childKey] = childObject[childKey];
			}
		} else value = divField.querySelector(`:scope > span.fieldvalue #value${id}`).value;
	}

	const retObject = {}; retObject[key] = value; return retObject;
}

export const settings_editor = {trueWebComponentMode: true, elementConnected, elementRendered, update, addArrayItem, deleteArrayItem}
monkshu_component.register("settings-editor", `${COMPONENT_PATH}/settings-editor.html`, settings_editor);
