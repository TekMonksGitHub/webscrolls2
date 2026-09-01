/**
 * Main entry point for admin data and handling. Initially
 * called from application.mjs 
 *  
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {util} from "/framework/js/util.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {default as jsYaml} from "../../3p/js-yaml.mjs";
import {loginmanager} from "../../js/loginmanager.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const CREATE_NEW_POST = "--- create", DEFAULT_POST = "default";
const MUSTACHE = await router.getMustache();
const API_AI = `${WEBSCROLLS_CONSTANTS.API_PATH}/ai`;
const API_DELETE = `${WEBSCROLLS_CONSTANTS.API_PATH}/delete`;
const API_PUBLISH = `${WEBSCROLLS_CONSTANTS.API_PATH}/publish`;
const SSE_URL_FOR_APIS = `${WEBSCROLLS_CONSTANTS.API_PATH}/appevents`;
const COMPONENT_PATH = util.getModulePath(import.meta), DIALOGS_PATH = `${COMPONENT_PATH}/../dialogs`;

let old_posttype, old_post, current_post_schema, dragging_to_resize=false, currentResizer, active_panel_id, current_post_type_rendered_html; 

async function createdata(dontAddBlanks=false, addPosts=false) {
    const themes = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/themes.json`);
    let posttypes = [...(await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${themes[0]}/schemas/posttypes.json`))];
    const firstPostType = posttypes[0]; if (!dontAddBlanks) posttypes = ["---", ...posttypes];
    let posts = dontAddBlanks ? [] : [CREATE_NEW_POST]; 
    try {if (firstPostType) posts = [...posts, await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${firstPostType}/posts.json`)];} 
    catch (err) {}; // no posts found for this post type, silent issue
    return addPosts ? {themes, posttypes, posts} : {themes, posttypes};
}	

async function getRenderedPost(theme, posttype, postid) {
    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    const htmlTemplateURL = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/${posttype}${posttype.endsWith(".html")?"":".html"}`;
    const htmlTemplate = await $$.requireText(htmlTemplateURL), postdata = await getPostData(theme, posttype, postid);
    try {
        const finalHTML = MUSTACHE.render(htmlTemplate, postdata);
        return finalHTML;
    } catch (err) {return null;}
}

async function getPostData(theme, posttype, postid, postobject) {
    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    const theme_post_types = theme ? 
        await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/schemas/posttypes.json`) : [];
    const skipPageTopSideBars = _isReservedPostType(posttype);
    
    const header = (!skipPageTopSideBars) && theme_post_types.includes("header") ? await getRenderedPost(theme, "header", "default") : undefined;
    const footer = (!skipPageTopSideBars) && theme_post_types.includes("footer") ? await getRenderedPost(theme, "footer", "default") : undefined;
    const leftbar = (!skipPageTopSideBars) && theme_post_types.includes("leftbar") ? await getRenderedPost(theme, "leftbar", "default") : undefined;
    const rightbar = (!skipPageTopSideBars) && theme_post_types.includes("rightbar") ? await getRenderedPost(theme, "rightbar", "default") : undefined;
    
    const posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${posttype}/${postid}.${lang}.yaml`;
    const postdata = postobject || jsYaml.load(await $$.requireText(posturl));
    
    return {header, footer, leftbar, rightbar, ...postdata};
}

async function themeselected(_element, theme) {
    try {
        const posttypes = ["---", ...(await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${theme}/schemas/posttypes.json`))];
        const selectPostTypes = document.querySelector("select#posttypes");
        let optionsHTML = ""; for (const posttype of posttypes) optionsHTML += `<option value="${posttype}">${posttype}</option>\n`;
        selectPostTypes.innerHTML = optionsHTML;
        _resetHeaderUI(false);
    } catch (err) {alert("Bad theme"); WEBSCROLLS_LOG.error(`Bad theme: ${theme}`); _resetHeaderUI();}
}

async function posttypeselected(_element, posttype) {
    if (posttype == old_posttype) return; else old_posttype = posttype;
    const selectThemes = document.querySelector("select#themeselector"), themeSelected = selectThemes.value;
    let pageSchema = {}, schemaError = false; 
    const isPostTypeReserved = _isReservedPostType(posttype);
    if (posttype !== "---") {   // this means no post is selected
        try {
            pageSchema = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${themeSelected}/schemas/${posttype}.json`);
            current_post_schema = pageSchema;
        } catch (err) {
            WEBSCROLLS_LOG.error(`Error fetching page schema for theme ${themeSelected} and post ${posttype}`);
            schemaError = true;
        }

        let posts = []; 
        try {posts = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${posttype}/posts.json`);} 
        catch (err) {}; // no posts found for this post type, silent issue
        
        const selectPosts = document.querySelector("select#posts");
        let optionsHTML = isPostTypeReserved ? `<option value="${DEFAULT_POST}">${DEFAULT_POST}</option>\n` :
            `<option value="${CREATE_NEW_POST}">${CREATE_NEW_POST}</option>\n`; 
        if (!isPostTypeReserved) for (const post of posts) optionsHTML += `<option value="${post}">${post}</option>\n`;
        selectPosts.innerHTML = optionsHTML; _setPostName(Date.now());
    } 

    const templatedata = _parseSchemaIntoTemplateData(pageSchema);
    const templateHTMLElement = document.querySelector("template#postschemaform");
    const templateHTML = util.unescapeHTML(templateHTMLElement.innerHTML);
    const partials = { arraytemplate: templateHTML };
    current_post_type_rendered_html = MUSTACHE.render(templateHTML, templatedata, partials);
    _reinitPostFields();
    if ((posttype == "---") || schemaError) {
        _disableDeleteButton(); _disablePublishButton(); _resetHeaderUI(false);
    } else {_enablePublishButton(); rerender();}
    postselected(_element, isPostTypeReserved ? DEFAULT_POST : CREATE_NEW_POST, true); // reset post selected
}

async function postselected(_element, post, reset) {
    if ((!reset) && post == old_post) return; else old_post = post;

    if (post !== CREATE_NEW_POST) {_enableDeleteButton(); _disablePostNameHeaderInput(); _setPostName(post);}
    else { _disableDeleteButton(); _enablePostNameHeaderInput(); _setPostName(Date.now()); _reinitPostFields(); rerender(); return; }

    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID), posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${old_posttype}/${post}.${lang}.yaml`;
    const postData = jsYaml.load(await $$.requireText(posturl)); 
    _renderPostItems(postData); rerender();
}

function addToArray(divArrayFields, fieldValue, isFirstFieldValue) {
    const newDiv = isFirstFieldValue ? divArrayFields : divArrayFields.cloneNode(true);
    newDiv.id = isFirstFieldValue ? newDiv.id : divArrayFields.id+Date.now(); _emptyFieldValues(newDiv); 
    if (!isFirstFieldValue) {
        newDiv.querySelector("span.arraycarddelete").classList.remove("displaynone"); 
        divArrayFields.parentNode.appendChild(newDiv);
    } else for (const childNode of divArrayFields.parentNode.querySelectorAll(":scope > div.arrayfields")) 
        if (childNode !== newDiv) divArrayFields.parentNode.removeChild(childNode); // delete all other current nodes
    for (const [key,value] of Object.entries(fieldValue)) {
        const isArray = Array.isArray(value);
        if (isArray) for (let i = 0; i < value.length; i++) {
            const divArrayFields = newDiv.querySelector(`#arrayfields${key}`);
            if (divArrayFields) addToArray(divArrayFields, value[i], i==0);
        } else {
            const inputField = newDiv.querySelector(`#value${key}`);
            if (inputField) inputField.value = value; 
            else WEBSCROLLS_LOG.error(`Missing array input field ${key}`);
        }
    }
}

function deleteFromArray(divArrayFields) {
    divArrayFields.parentNode.removeChild(divArrayFields);
}

async function publishPost(button) {
    if (button.classList.contains("headerbuttondisabledpublish")) return;  // disabled

    const post = _getPostObject();

    const postname = document.querySelector("input#postname").value;
    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    const posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${old_posttype}/${postname}.${lang}.yaml`;
    if ((await apiman.rest(API_PUBLISH, "POST", {postdata: post, posturl}, true)).result) {
        alert("Published"); _enableDeleteButton(); } else alert("Publishing failed!");
}

async function publishPostExternalCall(post, posttype, postname, lang) {
    if (_isReservedPostType(posttype)) postname = DEFAULT_POST; // override the name if the post type is reserved
    const posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${posttype}/${postname}.${lang}.yaml`;
    return (await apiman.rest(API_PUBLISH, "POST", {postdata: post, posturl}, true)).result;
}

async function deletePost(button) {
    if (button.classList.contains("headerbuttondisableddelete")) return;  // disabled
    const userConfirmed = confirm("Are you sure you want to permanently delete this post?");
    if (!userConfirmed) return;

    const postname = document.querySelector("input#postname").value;
    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    const posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${old_posttype}/${postname}.${lang}.yaml`;
    if ((await apiman.rest(API_DELETE, "POST", {posturl}, true)).result) {
        alert("Post has been deleted.\n\nYou can select a new post\nfrom the top menu."); _disableDeleteButton(); 
    } else alert("Deletion failed.");
}

function panelSelect(sender, panel) {
    if (!_activePanelChanged(sender)) return;

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

async function rerender() {
    const selectThemes = document.querySelector("select#themeselector"), themeSelected = selectThemes.value;
    const selectPostTypes = document.querySelector("select#posttypes"), posttype = selectPostTypes.value;
    const htmlTemplateURL = `${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${themeSelected}/${posttype}${posttype.endsWith(".html")?"":".html"}`;
    const previewIframe = document.querySelector('iframe#previewitem');
    const iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
    iframeDoc.open(); iframeDoc.write(""); iframeDoc.close();   // reset 

    try {
        const htmlTemplate = await $$.requireText(htmlTemplateURL), 
            post = await getPostData(themeSelected, posttype, undefined, _getPostObject());
        if (!htmlTemplate?.trim()) return; // can't render
        const finalHTML = MUSTACHE.render(htmlTemplate, post);
        iframeDoc.open(); iframeDoc.write(finalHTML); iframeDoc.close();
    } catch (err) {}   // error can't rerender due to bad json, schema or something
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
    }
    updateUI();
}

async function callai(prompt) {
    if (!current_post_schema) {alert("Please select a post type first."); return;}
    const divWorking = document.querySelector("div#working"); divWorking.classList.add("visible");
    const post_result = await apiman.rest(API_AI, "POST", {prompt, postschema: current_post_schema}, true, 
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, SSE_URL_FOR_APIS);
    const {post: postYaml, result} = post_result;
    if (result) {
        document.querySelector("textarea#postraw").value = postYaml;    // load post text area
        _renderPostItems(jsYaml.load(postYaml));                        // load post UI fields
        panelSelect(document.querySelector("span#postitem"), "postwork");   // shift focus to the fields tab
        rerender();                                                     // rerender the page
    } else alert("AI call failed, please retry with a new or same prompt.")
    divWorking.classList.remove("visible");
}

async function showLinkGenerator(_element) {
    const dialog = monkshu_env.components['dialog-box'];
    const initialData = await createdata(true, true);   // sets data for post selection headers

    initialData.link = window.monkshu_env.apps[WEBSCROLLS_CONSTANTS.APP_NAME].getRelativeURL(
        initialData.themes[0], initialData.posttypes[0], initialData.posts[0]); // the initial link

    // these are for XBin to point to the CMS and work correctly
    initialData.apipath = `${WEBSCROLLS_CONSTANTS.BACKEND}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`;
    initialData.appath = `${WEBSCROLLS_CONSTANTS.FRONTEND}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`;
    initialData.extrainfo = util.stringToBase64(JSON.stringify({apppath: `/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`, cmstype: "cms"}));
    
    dialog.showDialog(`${DIALOGS_PATH}/linkgen.html`, true, true, initialData, "postdialog");
}

const closeLinkDialog = _ => monkshu_env.components['dialog-box'].hideDialog("postdialog");

async function linkselectionchanged(element, value, type) {
    const shadowRoot = monkshu_env.components['dialog-box'].getShadowRootByContainedElement(element);
    if (type == "theme") {
        const posttypes = [...(await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${value}/schemas/posttypes.json`))];
        const selectPostTypes = shadowRoot.querySelector("select#posttypes");
        let optionsHTML = ""; for (const posttype of posttypes) if (!_isReservedPostType(posttype)) 
            optionsHTML += `<option value="${posttype}">${posttype}</option>\n`;
        selectPostTypes.innerHTML = optionsHTML;
        linkselectionchanged(element, posttypes[0], "posttype");
    } else if (type == "posttype") {
        let posts = []; 
        try {posts = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${value}/posts.json`);} 
        catch (err) {}; // no posts found for this post type, silent issue
        const selectPosts = shadowRoot.querySelector("select#posts");
        let optionsHTML = ""; for (const post of posts) optionsHTML += `<option value="${post}">${post}</option>\n`;
        selectPosts.innerHTML = optionsHTML;
        linkselectionchanged(element, posts[0], "post");
    } else if (type == "post") {
        const theme = shadowRoot.querySelector("select#themeselector").value;
        const posttype = shadowRoot.querySelector("select#posttypes").value;
        const link = window.monkshu_env.apps[WEBSCROLLS_CONSTANTS.APP_NAME].getRelativeURL(theme, posttype, value);
        shadowRoot.querySelector("span#link").innerText = link;
    }
}

const logout = _ => loginmanager.logout();


const _isReservedPostType = posttype => ["header", "footer", "leftbar", "rightbar"].includes(posttype);

function _getPostObject() {
    if (active_panel_id == "postraw") try{
            return jsYaml.load(document.querySelector("textarea#postraw").value); } catch (err) {
        alert(`Bad YAML: ${err}`); return {};
    }
    const divPostFields = document.querySelectorAll("div#postcreator > div.postfields"), post = {}; 
    for (const divPostField of divPostFields) {
        const postFieldObject = _extractFieldValue(divPostField), key = Object.keys(postFieldObject)[0];
        post[key] = postFieldObject[key];
    }
    return post;
}

function _reinitPostFields() {
    const divPostcreator = document.querySelector("div#postcreator");
    divPostcreator.innerHTML = current_post_type_rendered_html;
}

function _activePanelChanged(sender) {
    if (sender.id == "postitem") {
        const yaml = document.querySelector("textarea#postraw").value; 
        try {_renderPostItems(jsYaml.load(yaml));} catch (err) {alert(`Bad YAML: ${err}`); return false;}
    }
    if (sender.id == "postraw") {
        const yaml = jsYaml.dump(_getPostObject());
        document.querySelector("textarea#postraw").value = yaml;
    }
    active_panel_id = sender.id;

    return true;
}

function _renderPostItems(postData) {
    for (const [key, value] of Object.entries(postData)) {
        const isArray = Array.isArray(value);
        if (isArray) for (let i = 0; i < value.length; i++) {
            const divArrayFields = document.querySelector(`#arrayfields${key}`);
            if (divArrayFields) addToArray(divArrayFields, value[i], i==0);
            else WEBSCROLLS_LOG.error(`Missing div for array field ${key}`);
        } else {
            const input = document.querySelector(`#value${key}`);
            if (input && (!isArray)) input.value = value; else WEBSCROLLS_LOG.error(`Missing input field ${key}`);
        }
    }
}

function _extractFieldValue(divPostField) {
    const postfield = divPostField.querySelector(":scope > span.postfieldname");
    const key = postfield.id.substring(8), type = postfield.dataset.type;

    let value;
    if (type != "array") value = divPostField.querySelector(`:scope > span.postfieldvalue #value${key}`).value;
    else {
        value = [];
        const divArrayMembers = divPostField.querySelectorAll(`:scope > span.postfieldvalue > div.arrayfields`);
        for (const divArrayMember of divArrayMembers) {
            const divArrayFields = divArrayMember.querySelectorAll(`:scope > div.postfields`);
            const arrayMember = {};
            for (const divArrayField of divArrayFields) {
                const arrayObjectField = _extractFieldValue(divArrayField), keyThisObject = Object.keys(arrayObjectField)[0];
                arrayMember[keyThisObject] = arrayObjectField[keyThisObject];
            }
            value.push(arrayMember);
        }
    }

    const retObject = {}; retObject[key] = value; return retObject;
}

const _disablePublishButton = _ => document.querySelector("span#publishbutton").classList.add("headerbuttondisabledpublish");
const _enablePublishButton = _ => document.querySelector("span#publishbutton").classList.remove("headerbuttondisabledpublish");
const _disableDeleteButton = _ => document.querySelector("span#deletebutton").classList.add("headerbuttondisableddelete");
const _enableDeleteButton = _ => document.querySelector("span#deletebutton").classList.remove("headerbuttondisableddelete");
const _disablePostNameHeaderInput = _ => {
    document.querySelector("input#postname").classList.add("headerinputdisabled");
    document.querySelector("label#postlabel").classList.add("disabled");
}
const _enablePostNameHeaderInput = _ => {
    document.querySelector("input#postname").classList.remove("headerinputdisabled");
    document.querySelector("label#postlabel").classList.remove("disabled");
}
const _setPostName = name => document.querySelector("input#postname").value = name;
const _emptyFieldValues = rootNode => {
    const inputTypes = ["input", "textarea"]; 
    for (const inputType of inputTypes) for (const input of rootNode.querySelectorAll(inputType)) input.value = "";
}

function _resetHeaderUI(theme=true, posttype=true, createedit=true, name=true, deletebtn=true, publish=true) {
    const themeSelect = document.querySelector("select#themeselector"), posttypeSelect = document.querySelector("select#posttypes"),
        createoreditSelect = document.querySelector("select#posts"), inputName = document.querySelector("input#postname");

    const resetSelectedIndexToZero = select => {
        select.selectedIndex = 0; 
        const changeEvent = new Event('change', { bubbles: true }); select.dispatchEvent(changeEvent);
    }
    if (theme) resetSelectedIndexToZero(themeSelect);
    if (posttype) resetSelectedIndexToZero(posttypeSelect);
    if (createedit) {createoreditSelect.options.length = 0;}
    if (name) inputName.value = ""; 
    if (deletebtn) _disableDeleteButton();
    if (publish) _disablePublishButton();

    return;
}

function _parseSchemaIntoTemplateData(pageSchema, idprefix) {
    const templatedata = {schema:[]}; for (const [key, value] of Object.entries(pageSchema)) {
        if (key.endsWith("-schema")) continue;  // these are not real fields
        const idNormalized = `${idprefix?idprefix+"-":""}${key}`, nameNormalizaed = key.split("-").map(s => s[0].toLocaleUpperCase() + s.slice(1)).join(" ");
        let schema; if (value == "array") schema = _parseSchemaIntoTemplateData(pageSchema[`${key}-schema`], idNormalized).schema;
        templatedata.schema.push({name: nameNormalizaed, id: key, type: value, schema, 
            array: value=="array"?true:undefined, textarea: value=="textarea"?"true":undefined});
    }
    return templatedata;
}

export const post = {createdata, getPostData, getRenderedPost, themeselected, posttypeselected, 
    postselected, panelSelect, scaleIframe, addToArray, deleteFromArray, publishPost, deletePost, 
    logout, publishPostExternalCall, dragstart, dragged, dragstop, rerender, callai, showLinkGenerator,
    linkselectionchanged, closeLinkDialog};