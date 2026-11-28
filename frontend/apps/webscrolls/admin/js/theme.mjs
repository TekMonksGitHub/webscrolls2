/**
 * Main entry point for admin data and handling. Initially
 * called from application.mjs 
 *  
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {post} from "./post.mjs";
import {util} from "/framework/js/util.mjs";
import {permissions} from "./permissions.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {default as jsYaml} from "../../3p/js-yaml.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const API_AI = `${WEBSCROLLS_CONSTANTS.API_PATH}/ai`;
const SSE_URL_FOR_APIS = `${WEBSCROLLS_CONSTANTS.API_PATH}/appevents`;
const CREATE_NEW = "--- create", MUSTACHE = await router.getMustache();

const FILE_MANAGER_COMPONENT_ID = "fmtheme";
const FILE_MANAGER = _ => monkshu_env.components["file-manager"];

let old_posttype, dragging_to_resize=false, currentResizer, can_not_repaint, current_theme, current_posttype, current_theme_post_types;

const getthemes = async returnAll => {  // returns the themes the currently logged in user is allowed to access
    const allThemes = await _readObjectFileOrDefaultObjectOnError(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/themes.json`, []);
    if (returnAll) return allThemes;
    const themesUserIsAllowed = []; for (const theme of allThemes) 
        if (permissions.checkPermission(`site/${theme}`, permissions.read)) themesUserIsAllowed.push(theme);
    return themesUserIsAllowed;
}

const canCurrentUserCreateThemes = _ => permissions.checkPermission("site", permissions.write);
const canUserCreatePostTypes = theme => permissions.checkPermission(`site/${theme}`,permissions.write);
const canUserDeletePostTypes = theme => permissions.checkPermission(`site/${theme}`,permissions.delete);

async function createdata() {
    const themes = [...(await getthemes())];
    if (canCurrentUserCreateThemes()) themes.unshift(CREATE_NEW);
    const posttypes = [canCurrentUserCreateThemes()?CREATE_NEW:undefined];
    const extrainfo = util.stringToBase64(JSON.stringify({apppath: `/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`, cmstype: "themes"}));
    const apipath = `${WEBSCROLLS_CONSTANTS.BACKEND}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`;
    const appath = `${WEBSCROLLS_CONSTANTS.FRONTEND}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`;
    return {themes, posttypes, extrainfo, apipath, appath};
}

async function pageLoaded() {
    if (!canCurrentUserCreateThemes()) {    // load the first theme as they can't see option to create new
        const themesAllowed = await getthemes(); if (themesAllowed.length) themeselected(undefined, themesAllowed[0]);    
    } else themeselected(undefined, CREATE_NEW);
}

async function themeselected(_element, theme) {
    current_theme = theme;
    try {
        if (theme !== CREATE_NEW) {
            current_theme_post_types = await post.getPostTypes(theme);
            const posttypes = [...current_theme_post_types];
            if (canUserCreatePostTypes(theme)) posttypes.unshift(CREATE_NEW);
            const selectPostTypes = document.querySelector("select#posttypes");
            let optionsHTML = ""; for (const posttype of posttypes) optionsHTML += `<option value="${posttype}">${posttype}</option>\n`;
            selectPostTypes.innerHTML = optionsHTML; 
            const themename =  document.querySelector("input#themename"); themename.classList.add("headerinputdisabled"); themename.value = theme;
            _resetHeaderUI(false, false, false); 
        } else {
            const posttypes = [CREATE_NEW]; 
            const selectPostTypes = document.querySelector("select#posttypes");
            let optionsHTML = ""; for (const posttype of posttypes) optionsHTML += `<option value="${posttype}">${posttype}</option>\n`;
            selectPostTypes.innerHTML = optionsHTML; current_theme_post_types = undefined; 
            _resetHeaderUI(false); 
        }
    } catch (err) {alert("Bad theme" + err); WEBSCROLLS_LOG.error(`Bad theme: ${theme}`); _resetHeaderUI(false, false);}
}

async function posttypeselected(_element, posttype) {
    if (posttype == old_posttype) return; else old_posttype = posttype;

    if ((posttype == CREATE_NEW)) {
        _resetHeaderUI(false, false, false); rerender(true);
    } else {
        const posttypename =  document.querySelector("input#posttypename"); posttypename.classList.add("headerinputdisabled"); posttypename.value = posttype;
        current_posttype = posttype;
        const theme = document.querySelector("input#themename").value;
        const posttypeHTMLURL = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/${posttype}.html`;
        const posttypeSchemaURL = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/schemas/${posttype}.json`;
        const html = await $$.requireText(posttypeHTMLURL);
        const schema = await $$.requireText(posttypeSchemaURL);
        const htmlTemplateTextArea = document.querySelector('textarea#htmlitem');
        const schemaJSONTextArea = document.querySelector('textarea#schemaitem');
        const testpostitemTextArea = document.querySelector('textarea#testpostitem');
        htmlTemplateTextArea.value = html; schemaJSONTextArea.value = schema; testpostitemTextArea.value = "{}";
        if (canUserDeletePostTypes(current_theme)) _enableDeleteButton(); else _disableDeleteButton();
        rerender();
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

async function rerender(clear=false) {
    if (clear) {
        document.querySelector('textarea#htmlitem').value = "";
        document.querySelector('textarea#schemaitem').value = "";
        document.querySelector('textarea#testpostitem').value = "{}";
        (document.querySelector('iframe#previewitem').contentDocument || 
            document.querySelector('iframe#previewitem').contentWindow.document).body.innerHTML = '';
    }

    const htmlTemplate = document.querySelector('textarea#htmlitem').value, 
        postYAML = document.querySelector('textarea#testpostitem').value || "{}",
        previewIframe = document.querySelector('iframe#previewitem'),
        iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
    if ((!htmlTemplate?.trim()) || (!postYAML?.trim())) return; // can't render
    try {
        const postdata = await post.getPostData(current_theme, current_posttype, undefined, jsYaml.load(postYAML));
        const finalHTML = MUSTACHE.render(htmlTemplate, postdata);
        iframeDoc.open(); iframeDoc.write(finalHTML); iframeDoc.close();
    } catch (err) {LOG.error(`Can't re-render due to error ${err}`);}
}

async function publishThemeFile() {
    if ((current_theme == CREATE_NEW && (!canCurrentUserCreateThemes())) ||
            ((current_theme != CREATE_NEW) && (!canUserCreatePostTypes(current_theme))))
        {alert("Permissions don't allow this action."); return;}
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
    
    const themeRelativeURL = `/${theme}/${posttype}${posttype.endsWith(".html")?"":".html"}`;
    if (await publishThemeFileViaFilemanager(themeRelativeURL, htmlTemplate, schemaJSON)) {
        const publishTestPostResult = publishtestpost ? (await post.publishPostExternalCall(
            testpost, theme, posttype, testpostname, session.get($$.MONKSHU_CONSTANTS.LANG_ID), FILE_MANAGER(), FILE_MANAGER_COMPONENT_ID)) : true;
        alert(publishTestPostResult?"Published":"Theme template published but test post publishing failed"); 
        
        const posttypeNormalized = posttype.endsWith(".html") ? posttype.split(".").at(-2) : posttype;
        const posttypeSelect = document.querySelector("select#posttypes");
        const exists = Array.from(posttypeSelect.options).some(option => option.value === posttypeNormalized);
        if (!exists) {
            const newPostOption = new Option(posttypeNormalized, posttypeNormalized);
            posttypeSelect.add(newPostOption); posttypeSelect.selectedIndex = posttypeSelect.options.length-1;
        }
        const postname = document.querySelector("input#posttypename");
        postname.classList.add("headerinputdisabled");

    } else alert("Publishing failed!");

}

async function deleteThemeFile() {
    if (!canUserDeletePostTypes(current_theme)) {alert("Permissions don't allow this action."); return;}
    const theme = document.querySelector("input#themename").value,
        posttype = document.querySelector("input#posttypename").value;
    if ((!theme.trim()) || (!posttype.trim())) {
        alert("Missing data, unable to delete.");
        return; // can't publish
    }
    
    const themeRelativeURL = `/${theme}/${posttype}${posttype.endsWith(".html")?"":".html"}`;
    if (await deleteThemeFileViaFilemanager(themeRelativeURL)) {alert("Deleted"); _resetHeaderUI(false, false);}
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

async function callai() {
    const prompt = document.querySelector('textarea#aiitem').value;
    const header = current_theme_post_types?.includes("header") ? post.getRenderedPost(current_theme, "header", "default") : undefined;
    const footer = current_theme_post_types?.includes("footer") ? post.getRenderedPost(current_theme, "footer", "default") : undefined;
    const leftbar = current_theme_post_types?.includes("leftbar") ? post.getRenderedPost(current_theme, "leftsidebar", "default") : undefined;
    const rightbar = current_theme_post_types?.includes("rightbar") ? post.getRenderedPost(current_theme, "rightsidebar", "default") : undefined;

    const divWorking = document.querySelector("div#working"); divWorking.classList.add("visible");
    const html_schema_post_result = await apiman.rest(API_AI, "POST", {header, leftbar, rightbar, footer, prompt, type: "theme"}, 
        true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, SSE_URL_FOR_APIS);
    if (html_schema_post_result?.result) {
        const {html, schema, post, _airesponse} = html_schema_post_result;
        const htmlElement = document.querySelector("textarea#htmlitem");
        const schemaElement = document.querySelector("textarea#schemaitem");
        const testpostElement = document.querySelector("textarea#testpostitem");
        htmlElement.value = html; schemaElement.value = schema; testpostElement.value = post;
        await rerender();
    } else alert("AI call failed, please retry with a new or same prompt.")
    divWorking.classList.remove("visible");
}

const getThemeTemplate = (theme, posttype) => $$.requireText(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/${posttype}${posttype.endsWith(".html")?"":".html"}`);

const logout = _ => loginmanager.logout();
const _disableDeleteButton = _ => document.querySelector("span#deletebutton").classList.add("headerbuttondisableddelete");
const _enableDeleteButton = _ => document.querySelector("span#deletebutton").classList.remove("headerbuttondisableddelete");
const _disablePublishButton = _ => document.querySelector("span#publishbutton").classList.add("headerbuttondisabledpublish");
const _enablePublishButton = _ => document.querySelector("span#publishbutton").classList.remove("headerbuttondisabledpublish");

function _resetHeaderUI(theme=true, themenameinput=true, posttype=true, postnameinput=true, deletebtn=true, publishbtn=true) {
    const themeSelect = document.querySelector("select#themeselector"), posttypeSelect = document.querySelector("select#posttypes");
    const themename = document.querySelector("input#themename"), postname = document.querySelector("input#posttypename");
    const resetSelectedIndexToZero = select => {
        select.options.length = 1; select.selectedIndex = 0;
        const changeEvent = new Event('change', { bubbles: true }); select.dispatchEvent(changeEvent);
    }
    if (theme) resetSelectedIndexToZero(themeSelect);
    if (themenameinput) {themename.classList.remove("headerinputdisabled"); themename.value = "";}
    if (postnameinput) {postname.classList.remove("headerinputdisabled"); postname.value = "";}
    if (posttype) resetSelectedIndexToZero(posttypeSelect); else {const changeEvent = new Event('change', { bubbles: true }); posttypeSelect.dispatchEvent(changeEvent);}
    if (deletebtn) _disableDeleteButton();
    if (publishbtn) {
        _disablePublishButton();
        if (canUserCreatePostTypes(current_theme) || canCurrentUserCreateThemes()) _enablePublishButton();
    }

    return;
}
const _parseJSONArray = s => {try {const v = JSON.parse(s); return Array.isArray(v) ? v : null;} catch {return null;}};

async function publishThemeFileViaFilemanager(themeurl, htmlTemplate, schemaJSON) {
    const finalPath = themeurl;
    const themePath = finalPath.split("/").slice(0,-1).join("/");
    const parentThemeDir = themePath.split("/").slice(0,-1).join("/");
    const themefilename = finalPath.split("/").at(-1).replace(/\.html$/, "");
    const themename = themeurl.split("/").at(-2);
    const postTypesResult = await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, `${themePath}/schemas/posttypes.json`, "read");
    if (!postTypesResult) return false; // network or other backend issue
    if ((!postTypesResult.result) && await FILE_MANAGER().checkFileExists(
      `${themePath}/schemas/posttypes.json`, FILE_MANAGER_COMPONENT_ID)) return false;  // network or other backend issue
    let posttypes = postTypesResult.result ? _parseJSONArray(postTypesResult.data) : [];
    if (!posttypes) {alert(`Post types is corrupt. ${themePath}/schemas/posttypes.json`); return false;}   // corrupted JSON
    posttypes = [...(new Set(posttypes).add(themefilename))];	// remove duplicates in case of edits to an existing theme file
    const posttypesJSON = JSON.stringify(posttypes, null, 2);
    const themesResult = await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, `${parentThemeDir}/themes.json`, "read");
    if (!themesResult) return false;    // network or other backend issue
    if ((!themesResult.result) && await FILE_MANAGER().checkFileExists(
      `${parentThemeDir}/themes.json`, FILE_MANAGER_COMPONENT_ID)) return false;  // network or other backend issue
    let themes = themesResult.result ? _parseJSONArray(themesResult.data) : [];
    if (!themes) {alert(`Themes JSON is corrupt. ${parentThemeDir}/themes.json`); return false;}
    themes = [...(new Set(themes).add(themename))];	// remove duplicates in case of edits to an existing theme file
    const themesJSON = JSON.stringify(themes, null, 2);

    if (!(await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, 
        finalPath, "write", htmlTemplate))?.result) return false; 
    if (!(await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, 
        `${themePath}/schemas/${themefilename}.json`, "write", schemaJSON))?.result) return false; 
    if (!(await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, 
        `${themePath}/schemas/posttypes.json`, "write", posttypesJSON))?.result) return false; 
    if (!(await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, 
        `${parentThemeDir}/themes.json`, "write", themesJSON))?.result) return false; 
    return true;
}

async function deleteThemeFileViaFilemanager(themeurl) {
    const finalPath = themeurl;
    const themePath = finalPath.split("/").slice(0,-1).join("/");
    const themefilename = finalPath.split("/").at(-1).replace(/\.html$/, "");    
    const postTypesResult = await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, `${themePath}/schemas/posttypes.json`, "read");
    if (!postTypesResult) return false; // network or other backend issue
    if ((!postTypesResult.result) && await FILE_MANAGER().checkFileExists(
        `${themePath}/schemas/posttypes.json`, FILE_MANAGER_COMPONENT_ID)) return false;    // network or other backend issue
    let posttypes = postTypesResult.result ? _parseJSONArray(postTypesResult.data) : [];
    if (!posttypes) {alert(`Post types is corrupt. ${themePath}/schemas/posttypes.json`); return false;}   // corrupted JSON
    posttypes = posttypes.filter(p => p !== themefilename);
    const posttypesJSON = JSON.stringify(posttypes, null, 2);

    if (!(await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, 
        `${themePath}/schemas/posttypes.json`, "write", posttypesJSON))?.result) return false; 
    if (!(await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, 
        finalPath, "delete"))?.result) return false;
    await FILE_MANAGER().operateFileExternal(FILE_MANAGER_COMPONENT_ID, `${themePath}/schemas/${themefilename}.json`, "delete");
    return true;
}

const _readObjectFileOrDefaultObjectOnError = async (url, defaultObject) => {
    try {return await $$.requireJSON(url);} catch (err) {return defaultObject;}
}

export const theme = {createdata, themeselected, posttypeselected, dragstart, callai, logout,
    dragged, dragstop, panelSelect, rerender, scaleIframe, publishThemeFile, deleteThemeFile, 
    getThemeTemplate, getthemes, pageLoaded};
window.theme = theme;   // needed to avoid race in theme.html as pageLoaded fires onchange event due to header UI reset which causes HTML's select boxes to look for theme variable