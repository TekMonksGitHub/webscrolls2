/**
 * Main entry point for admin data and handling. Initially
 * called from application.mjs 
 *  
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {post} from "./post.mjs";
import {router} from "/framework/js/router.mjs";
import {default as jsYaml} from "../3p/js-yaml.mjs";
import {loginmanager} from "../js/loginmanager.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const CREATE_NEW = "--- create", MUSTACHE = await router.getMustache();
const API_AI = `${WEBSCROLLS_CONSTANTS.API_PATH}/ai`;
const API_DELETE_THEME_FILE = `${WEBSCROLLS_CONSTANTS.API_PATH}/deletethemefile`;
const API_PUBLISH_THEME_FILE = `${WEBSCROLLS_CONSTANTS.API_PATH}/publishthemefile`;

let old_posttype, dragging_to_resize=false, currentResizer, can_not_repaint;

async function createdata() {
    const themes = [CREATE_NEW, ...(await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/themes.json`))];
    const posttypes = [CREATE_NEW];
    return {themes, posttypes};
}

async function themeselected(_element, theme) {
    try {
        if (theme !== CREATE_NEW) {
            const posttypes = [CREATE_NEW, ...(await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/schemas/posttypes.json`))];
            const selectPostTypes = document.querySelector("select#posttypes");
            let optionsHTML = ""; for (const posttype of posttypes) optionsHTML += `<option value="${posttype}">${posttype}</option>\n`;
            selectPostTypes.innerHTML = optionsHTML; 
            const themename =  document.querySelector("input#themename"); themename.classList.add("headerinputdisabled"); themename.value = theme;
            _resetHeaderUI(false, false, false);
        } else _resetHeaderUI(false);
    } catch (err) {alert("Bad theme" + err); WEBSCROLLS_LOG.error(`Bad theme: ${theme}`); _resetHeaderUI(false, false);}
}

async function posttypeselected(_element, posttype) {
    if (posttype == old_posttype) return; else old_posttype = posttype;

    if ((posttype == CREATE_NEW)) {
        _resetHeaderUI(false, false);
    } else {
        const posttypename =  document.querySelector("input#posttypename"); posttypename.classList.add("headerinputdisabled"); posttypename.value = posttype;
        const theme = document.querySelector("input#themename").value;
        const posttypeHTMLURL = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/${posttype}.html`;
        const posttypeSchemaURL = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/schemas/${posttype}.json`;
        const html = await $$.requireText(posttypeHTMLURL);
        const schema = await $$.requireText(posttypeSchemaURL);
        const htmlTemplateTextArea = document.querySelector('textarea#htmlitem');
        const schemaJSONTextArea = document.querySelector('textarea#schemaitem');
        htmlTemplateTextArea.value = html; schemaJSONTextArea.value = schema;
        _enableDeleteButton();
    }
}

function dragstart(event, element) {
    event.preventDefault();
    dragging_to_resize = true; currentResizer = element;
    window.addEventListener('mousemove', dragged);
    window.addEventListener('mouseup', dragstop);
};

function dragstop(event) {
    event.preventDefault();
    dragging_to_resize = false; currentResizer = null;
    window.removeEventListener('mousemove', dragged);
    window.removeEventListener('mouseup', dragstop);
};

function dragged(event) {
    if ((!dragging_to_resize) || (!currentResizer)) return;
    event.preventDefault(); 

    const updateUI = _ => {
        if (!currentResizer) return;
        const leftPanel = currentResizer.previousElementSibling;
        const rightPanel = currentResizer.nextElementSibling;
        const container = currentResizer.parentElement;
        const containerRect = container.getBoundingClientRect();
        
        // Mouse X position relative to container
        const mouseX = event.clientX - containerRect.left;
        const resizerWidth = currentResizer.offsetWidth;
        
        const minWidth = 50; // minimum 50px for each panel
        const maxWidth = containerRect.width - resizerWidth - minWidth; // Set minimum bounds
        if (mouseX >= minWidth && mouseX <= maxWidth) {
            leftPanel.style.width = mouseX + 'px'; // Left panel ends at mouse position
            rightPanel.style.width = (containerRect.width - mouseX - resizerWidth) + 'px'; // Right panel starts after resizer
        }
        can_not_repaint = false;
    }

    if (!can_not_repaint) {window.requestAnimationFrame(updateUI); can_not_repaint = true;}
}

function panelSelect(sender, panel) {
    const allTabs = document.querySelectorAll(`div#${panel} span.paneltab`);
    const allPanels = document.querySelectorAll(`div#${panel} div.panelcontent`);

    for (const tab of allTabs) {
        if (tab.id == sender.id) tab.classList.remove("unselected");
        else tab.classList.add("unselected");
    }

    for (const panel of allPanels) {
        if (panel.id == sender.id) panel.classList.remove("displaynone");
        else panel.classList.add("displaynone");
    }
}

function rerender() {
    const htmlTemplate = document.querySelector('textarea#htmlitem').value, 
        postYAML = document.querySelector('textarea#testpostitem').value,
        previewIframe = document.querySelector('iframe#previewitem'),
        iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
    if ((!htmlTemplate?.trim()) || (!postYAML?.trim())) return; // can't render
    try {
        const finalHTML = MUSTACHE.render(htmlTemplate, jsYaml.load(postYAML));
        iframeDoc.open(); iframeDoc.write(finalHTML); iframeDoc.close();
    } catch (err) {/* we can't preview some issue with html or json*/}
}

async function publishThemeFile() {
    const htmlTemplate = document.querySelector("textarea#htmlitem").value, 
        schemaJSON = document.querySelector("textarea#schemaitem").value, 
        theme = document.querySelector("input#themename").value,
        posttype = document.querySelector("input#posttypename").value,
        testpost = document.querySelector("textarea#testpostitem").value, 
        testpostname = document.querySelector("input#testpostname").value, 
        publishtestpost = document.querySelector("input#publishtestpost").checked;
    if ((!htmlTemplate?.trim()) || (!schemaJSON?.trim()) || (!theme.trim()) || (!posttype.trim())) {
        alert("Missing data, unable to publish.");
        return; // can't publish
    }
    
    const themeurl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/${posttype}${posttype.endsWith(".html")?"":".html"}`;
    if ((await apiman.rest(API_PUBLISH_THEME_FILE, "POST", {themeurl, 
            template: htmlTemplate, schemaJSON}, true)).result) {
        const publishTestPostResult = publishtestpost ? (await post.publishPostExternalCall(
            testpost, posttype, testpostname, session.get($$.MONKSHU_CONSTANTS.LANG_ID))).result : true;
        if (publishTestPostResult) alert("Published"); else ("Theme template published but test post publishing failed");
        
        const posttypeNormalized = posttype.endsWith(".html") ? posttype.split(".").at(-2) : posttype;
        const newPostOption = new Option(posttypeNormalized, posttypeNormalized);
        const posttypeSelect = document.querySelector("select#posttypes");
        posttypeSelect.add(newPostOption); posttypeSelect.selectedIndex = posttypeSelect.options.length-1;
        const postname = document.querySelector("input#posttypename");
        postname.classList.add("headerinputdisabled");

    } else alert("Publishing failed!");

}

async function deleteThemeFile() {
    const theme = document.querySelector("input#themename").value,
        posttype = document.querySelector("input#posttypename").value;
    if ((!theme.trim()) || (!posttype.trim())) {
        alert("Missing data, unable to delete.");
        return; // can't publish
    }
    
    const themeurl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/${posttype}${posttype.endsWith(".html")?"":".html"}`;
    if ((await apiman.rest(API_DELETE_THEME_FILE, "POST", {themeurl}, true)).result) {alert("Deleted"); _resetHeaderUI(false, false);}
    else alert("Deletion failed!");

}

function scaleIframe(type) {
    const iframe = document.querySelector('iframe#previewitem');
    const zoomtextElement = document.querySelector('span#zoomtext');
    const currentScale = parseFloat(iframe.dataset.scale) || 1.0;
    const toScaleTo = type == "minus" ? currentScale - 0.1 : currentScale + 0.1;
    iframe.contentWindow.document.body.style.zoom = `${Math.round(toScaleTo*100)}%`;
    iframe.setAttribute("data-scale", toScaleTo);
    const zoomtext = `Zoom: ${Math.round(toScaleTo*100)}%`;
    zoomtextElement.innerHTML = zoomtext;
}

async function callai(prompt) {
    const divWorking = document.querySelector("div#working"); divWorking.classList.add("visible");
    const html_schema_post_result = await apiman.rest(API_AI, "POST", {prompt}, true);
    const {html, schema, post, _airesponse, result} = html_schema_post_result;
    if (result) {
        const htmlElement = document.querySelector("textarea#htmlitem");
        const schemaElement = document.querySelector("textarea#schemaitem");
        const testpostElement = document.querySelector("textarea#testpostitem");
        htmlElement.value = html; schemaElement.value = schema; testpostElement.value = post;
        rerender();
    } else alert("AI call failed, please retry with a new or same prompt.")
    divWorking.classList.remove("visible");
}

const logout = _ => loginmanager.logout();


const _disableDeleteButton = _ => document.querySelector("span#deletebutton").classList.add("headerbuttondisableddelete");
const _enableDeleteButton = _ => document.querySelector("span#deletebutton").classList.remove("headerbuttondisableddelete");

function _resetHeaderUI(theme=true, themenameinput=true, posttype=true, postnameinput=true, deletebtn=true) {
    const themeSelect = document.querySelector("select#themeselector"), posttypeSelect = document.querySelector("select#posttypes");
    const themename = document.querySelector("input#themename"), postname = document.querySelector("input#posttypename");
    const resetSelectedIndexToZero = select => {
        select.options.length = 1; select.selectedIndex = 0;
        const changeEvent = new Event('change', { bubbles: true }); select.dispatchEvent(changeEvent);
    }
    if (theme) themeSelect.selectedIndex = 0;
    if (posttype) resetSelectedIndexToZero(posttypeSelect);
    if (themenameinput) {themename.classList.remove("headerinputdisabled"); themename.value = "";}
    if (postnameinput) {postname.classList.remove("headerinputdisabled"); postname.value = "";}
    if (deletebtn) _disableDeleteButton();

    return;
}


export const theme = {createdata, themeselected, posttypeselected, dragstart, callai, logout,
    dragged, dragstop, panelSelect, rerender, scaleIframe, publishThemeFile, deleteThemeFile};