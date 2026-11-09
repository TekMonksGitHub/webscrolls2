/**
 * Universal file viewer component. Renders images, video, audio, PDF, Word (docx),
 * spreadsheets (xlsx, xls, ods, csv, tsv), Markdown and plain text / code inline.
 * Created by AI under the guidance of a human. Human edited, reviewed and tested.
 *
 * (C) 2026 TekMonks. All rights reserved.
 * License: See enclosed LICENSE file.
 *
 * Usage:
 *   <file-viewer src="blob:..." filename="report.docx"></file-viewer>
 *
 * Attributes:
 *   src       Blob object URL of the file. The caller owns it: keep it alive while the viewer
 *             is open and revoke it afterwards. 
 *   filename  Name of the file, used for type detection and the download link.
 *
 * Third party libraries live in ./3p and are loaded only when a file needs them.
 */

import {util} from "/framework/js/util.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const COMPONENT_PATH = util.getModulePath(import.meta);

// global is what each script defines, used to skip reloading
const LIBS = {
    jszip: {url: `${COMPONENT_PATH}/3p/jszip.min.js`, global: "JSZip"},
    docx: {url: `${COMPONENT_PATH}/3p/docx-preview.min.js`, global: "docx"},
    xlsx: {url: `${COMPONENT_PATH}/3p/xlsx.full.min.js`, global: "XLSX"},
    marked: {url: `${COMPONENT_PATH}/3p/marked.umd.js`, global: "marked"},
    purify: {url: `${COMPONENT_PATH}/3p/purify.min.js`, global: "DOMPurify"}
};

const TYPES = {
    image: ["png","jpg","jpeg","gif","webp","svg","bmp","ico","avif"],
    video: ["mp4","webm","ogv","mov","m4v"],
    audio: ["mp3","wav","ogg","oga","m4a","aac","flac"],
    pdf: ["pdf"],
    docx: ["docx"],
    sheet: ["xlsx","xlsm","xls","ods","csv","tsv"],
    markdown: ["md","markdown"],
    text: ["txt","log","json","js","mjs","ts","css","html","htm","xml","yaml","yml","ini","conf","sh",
        "py","java","c","cpp","h","cs","go","rs","sql","properties","env"]
};

const OBJECT_URLS = new WeakMap();

async function elementDisconnected(host) {
    if (OBJECT_URLS.has(host)) {URL.revokeObjectURL(OBJECT_URLS.get(host)); OBJECT_URLS.delete(host);}
}

async function elementRendered(host, initialRender) {
    const url = host.getAttribute("src"), filename = host.getAttribute("filename") || "file";
    if (!initialRender || !url) return;

    try {
        const blob = await (await fetch(url)).blob();
        // trust the file's own bytes over its name, so a mislabelled file is never dumped as text
        const sniffed = await _sniffBlob(blob, _getExtension(filename));
        const ext = sniffed.ext || _getExtension(filename);
        let type = _getType(ext);
        if ((type == "text" || type == "markdown") && sniffed.binary) type = null;

        let finalURL = url;
        if (type == "pdf" && blob.type !== "application/pdf" && host.isConnected) {
            finalURL = URL.createObjectURL(new Blob([blob], {type: "application/pdf"})); OBJECT_URLS.set(host, finalURL); 
        }
        if (["image","video","audio","pdf"].includes(type)) _setContent(host, _createMediaElement(type, finalURL, filename));
        else if (type == "docx") await _renderDocx(host, blob);
        else if (type == "sheet") await _renderSheet(host, blob, ext);
        else if (type == "markdown") await _renderMarkdown(host, blob);
        else if (type == "text") await _renderText(host, blob);
        else _showMessage(host, `Preview is not available for ${ext ? "." + ext + " files" : "this file type"}.`, url, filename);
    } catch (err) { _showMessage(host, `Could not display this file. ${err.message}`, url, filename, true); }
}

async function _renderDocx(host, blob) {
    _showStatus(host, "Rendering document...");
    await _loadScript(LIBS.jszip); await _loadScript(LIBS.docx);
    const wrapper = document.createElement("div"); wrapper.className = "docx-host";
    // styles go into the same container so they live inside the shadow root
    await window.docx.renderAsync(await blob.arrayBuffer(), wrapper, wrapper,
        {inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true});
    _setContent(host, wrapper);
}

async function _renderSheet(host, blob, ext) {
    _showStatus(host, "Rendering spreadsheet...");
    await _loadScript(LIBS.xlsx); await _loadScript(LIBS.purify);

    const readOptions = ext == "tsv" ? {type: "string", FS: "\t"} : {type: "array"};
    const data = ext == "tsv" ? await blob.text() : await blob.arrayBuffer();
    const workbook = window.XLSX.read(data, readOptions);

    const wrapper = document.createElement("div"); wrapper.className = "sheet-host";
    const tabs = document.createElement("div"); tabs.className = "sheet-tabs";
    const tableHost = document.createElement("div"); tableHost.className = "sheet-table";

    const showSheet = name => {
        tableHost.innerHTML = window.DOMPurify.sanitize(window.XLSX.utils.sheet_to_html(workbook.Sheets[name], {header: "", footer: ""}));
        for (const tab of tabs.children) tab.classList.toggle("active", tab.dataset.sheet == name);
    };
    if (workbook.SheetNames.length > 1) for (const name of workbook.SheetNames) {
        const tab = document.createElement("button"); tab.textContent = name; tab.dataset.sheet = name;
        tab.addEventListener("click", _ => showSheet(name)); tabs.appendChild(tab);
    }
    if (tabs.children.length) wrapper.appendChild(tabs);
    wrapper.appendChild(tableHost);
    showSheet(workbook.SheetNames[0]);
    _setContent(host, wrapper);
}

async function _renderMarkdown(host, blob) {
    await _loadScript(LIBS.marked); await _loadScript(LIBS.purify);
    const wrapper = document.createElement("div"); wrapper.className = "markdown-host";
    wrapper.innerHTML = window.DOMPurify.sanitize(window.marked.parse(await blob.text()));
    _setContent(host, wrapper);
}

async function _renderText(host, blob) {
    const pre = document.createElement("pre"); pre.className = "text-host"; pre.textContent = await blob.text();
    _setContent(host, pre);
}

function _createMediaElement(type, url, filename) {
    if (type == "pdf") {
        const frame = document.createElement("iframe");
        frame.src = url; frame.className = "frame-host"; frame.title = filename;
        return frame;
    }
    const element = document.createElement(type == "image" ? "img" : type);
    element.src = url; element.className = `media-host ${type}`;
    if (type == "image") element.alt = filename; else element.controls = true;
    return element;
}

function _showStatus(host, message) {
    const status = document.createElement("div"); status.className = "status"; status.textContent = message;
    _setContent(host, status);
}

function _showMessage(host, message, downloadURL, filename, isError) {
    const box = document.createElement("div"); box.className = `status${isError ? " error" : ""}`;
    const text = document.createElement("p"); text.textContent = message; box.appendChild(text);
    const link = document.createElement("a"); link.href = downloadURL; link.download = filename;
    link.textContent = "Download file"; link.className = "download"; box.appendChild(link);
    _setContent(host, box);
}

function _setContent(host, node) {
    host.shadowRoot?.querySelector("#viewer")?.replaceChildren(node);
}

function _getExtension(filename) {
    return filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
}

function _getType(ext) {
    for (const [type, extensions] of Object.entries(TYPES)) if (extensions.includes(ext)) return type;
    return null;
}

/**
 * Detects the real file type from its leading bytes.
 * @returns {ext, binary} ext is the detected extension or null, binary is true if the content is not text
 */
async function _sniffBlob(blob, currentExt) {
    const bytes = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
    const head = String.fromCharCode(...bytes.subarray(0, 1024));   // latin1 view, safe for signature checks
    const startsWith = (...sig) => sig.every((b, i) => bytes[i] == b);

    let ext = null;
    if (head.includes("%PDF-")) ext = "pdf";    // spec allows the header anywhere in the first 1KB
    else if (startsWith(0x89,0x50,0x4E,0x47)) ext = "png";
    else if (startsWith(0xFF,0xD8,0xFF)) ext = "jpg";
    else if (head.startsWith("GIF8")) ext = "gif";
    else if (head.startsWith("RIFF") && head.substring(8, 12) == "WEBP") ext = "webp";
    else if (head.startsWith("PK\x03\x04")) {   // zip container, Office files list their parts in plain text
        if (["docx","xlsx","xlsm","ods","pptx"].includes(currentExt)) ext = currentExt;
        else {
            const zipNames = new TextDecoder("latin1").decode(bytes);
            ext = zipNames.includes("word/") ? "docx" : zipNames.includes("xl/") ? "xlsx" :
                zipNames.includes("ppt/") ? "pptx" : "zip";
        }
    }
    else if (startsWith(0xD0,0xCF,0x11,0xE0)) ext = ["doc","xls","ppt"].includes(currentExt) ? currentExt : "doc";  // legacy Office

    const binary = ext ? true : bytes.subarray(0, 8192).includes(0);   // NUL bytes never appear in real text files
    return {ext, binary};
}

// $$.require re-runs a script on every call, so skip it once the library's global exists
async function _loadScript(lib) {
    if (!window[lib.global]) await $$.require(lib.url);
}

export const file_viewer = {trueWebComponentMode: true, elementRendered, elementDisconnected};
monkshu_component.register("file-viewer", `${COMPONENT_PATH}/file-viewer.html`, file_viewer);