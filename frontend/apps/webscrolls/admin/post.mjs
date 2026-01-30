/**
 * Main entry point for admin data and handling. Initially
 * called from application.mjs 
 *  
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import {default as jsYaml} from "../3p/js-yaml.mjs";
import {loginmanager} from "../js/loginmanager.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";

const CREATE_NEW_POST = "--- create";
const API_DELETE = `${WEBSCROLLS_CONSTANTS.API_PATH}/delete`;
const API_PUBLISH = `${WEBSCROLLS_CONSTANTS.API_PATH}/publish`;

let old_posttype, old_post; 

async function createdata() {
    const themes = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/themes.json`);
    const posttypes = ["---", ...(await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${themes[0]}/schemas/posttypes.json`))];
    return {themes, posttypes};
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
    if (posttype !== "---") {   // this means no post is selected
        try {pageSchema = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/themes/${themeSelected}/schemas/${posttype}.json`)} catch (err) {
            WEBSCROLLS_LOG.error(`Error fetching page schema for theme ${themeSelected} and post ${posttype}`);
            schemaError = true;
        }

        let posts = []; 
        try {posts = await $$.requireJSON(`${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${posttype}/posts.json`);} 
        catch (err) {WEBSCROLLS_LOG.warn(`No posts found for post type ${posttype}`);}
        
        const selectPosts = document.querySelector("select#posts");
        let optionsHTML = `<option value="${CREATE_NEW_POST}">${CREATE_NEW_POST}</option>\n`; 
        for (const post of posts) optionsHTML += `<option value="${post}">${post}</option>\n`;
        selectPosts.innerHTML = optionsHTML; _setPostName(Date.now());
        
    } 

    const templatedata = _parseSchemaIntoTemplateData(pageSchema);
    const templateHTMLElement = document.querySelector("template#postschemaform");
    const templateHTML = templateHTMLElement.innerHTML;
    const renderedHTML = (await router.getMustache()).render(templateHTML, templatedata);
    const divPostcreator = document.querySelector("div#postcreator");
    divPostcreator.innerHTML = renderedHTML;
    if ((posttype == "---") || schemaError) {
        _disableDeleteButton(); _disablePublishButton(); _resetHeaderUI(false);
    } else _enablePublishButton();
}

async function postselected(_element, post) {
    if (post == old_post) return; else old_post = post;

    if (post !== CREATE_NEW_POST) {_enableDeleteButton(); _disablePostNameHeaderInput(); _setPostName(post);}
    else { _disableDeleteButton(); _enablePostNameHeaderInput(); _setPostName(Date.now()); 
        _emptyFieldValues(document.querySelector("div#postcreator")); return; }

    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID), posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${old_posttype}/${post}.${lang}.yaml`;
    const postData = jsYaml.load(await $$.requireText(posturl));
    for (const [key, value] of Object.entries(postData)) {
        const isArray = Array.isArray(value);
        if (isArray) for (let i = 0; i < value.length; i++) {
            const divArrayFields = document.querySelector(`#arrayfields${key}`);
            if (divArrayFields) addToArray(document.querySelector(`#arrayfields${key}`), value[i], i==0);
            else WEBSCROLLS_LOG.error(`Missing div for array field ${key}`);
        } else {
            const input = document.querySelector(`#value${key}`);
            if (input && (!isArray)) input.value = value; else WEBSCROLLS_LOG.error(`Missing input field ${key}`);
        }
    }
}

async function addToArray(divArrayFields, fieldValue, fillGivenDiv) {
    const newDiv = fillGivenDiv ? divArrayFields : divArrayFields.cloneNode(true);
    newDiv.id = fillGivenDiv ? newDiv.id : divArrayFields.id+Date.now(); _emptyFieldValues(newDiv); 
    if (!fillGivenDiv) {
        newDiv.querySelector("span.arraycarddelete").classList.remove("displaynone"); 
        divArrayFields.parentNode.appendChild(newDiv);
    }
    for (const [key,value] of Object.entries(fieldValue)) {
        const inputField = newDiv.querySelector(`#value${key}`);
        if (inputField) inputField.value = value; 
        else WEBSCROLLS_LOG.error(`Missing array input field ${key}`);
    }
}

async function deleteFromArray(divArrayFields) {
    divArrayFields.parentNode.removeChild(divArrayFields);
}

async function publishPost(button) {
    if (button.classList.contains("headerbuttondisabledpublish")) return;  // disabled

    const divPostFields = document.querySelectorAll("div.postfields"), post = {}; 
    for (const divPostField of divPostFields) {
        const postFieldObject = _extractFieldValue(divPostField), key = Object.keys(postFieldObject)[0];
        post[key] = postFieldObject[key];
    }

    const postname = document.querySelector("input#postname").value;
    const lang = session.get($$.MONKSHU_CONSTANTS.LANG_ID);
    const posturl = `${WEBSCROLLS_CONSTANTS.APP_PATH}/cms/${old_posttype}/${postname}.${lang}.yaml`;
    if ((await apiman.rest(API_PUBLISH, "POST", {postdata: post, posturl}, true)).result) {
        alert("Published"); _enableDeleteButton(); } else alert("Publishing failed!");
}

async function publishPostExternalCall(post, posttype, postname, lang) {
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

const logout = _ => loginmanager.logout();


function _extractFieldValue(divPostField) {
    const postfield = divPostField.querySelector("span.postfieldname");
    const key = postfield.id.substring(8), type = postfield.dataset.type;
        
    let value; if (type != "array") value = divPostField.querySelector(`#value${key}`).value; else {
        value = []; for (const divArrayMember of divPostField.querySelectorAll(`div.arrayfields`)) {
            const divArrayFields = divArrayMember.querySelectorAll(`div.arraypostfields`);
            const arrayMember = {}; for (const divArrayField of divArrayFields) {
                const arrayObjectField = _extractFieldValue(divArrayField), keyThisObject = Object.keys(arrayObjectField)[0];
                arrayMember[keyThisObject] = arrayObjectField[keyThisObject];
            }
            value.push(arrayMember);
        }
    }

    const retObject = {}; retObject[key] = value; return retObject
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

function _parseSchemaIntoTemplateData(pageSchema) {
    const templatedata = {schema:[]}; for (const [key, value] of Object.entries(pageSchema)) {
        if (key.endsWith("-schema")) continue;  // these are not real fields
        let schema; if (value == "array") schema = _parseSchemaIntoTemplateData(pageSchema[`${key}-schema`]).schema;
        templatedata.schema.push({name: key.split("-").map(s => s[0].toLocaleUpperCase() + s.slice(1)).join(" "), 
            id: key, type: value, schema, array: value=="array"?true:undefined, textarea: value=="textarea"?"true":undefined});
    }
    return templatedata;
}

export const post = {createdata, themeselected, posttypeselected, postselected, 
    addToArray, deleteFromArray, publishPost, deletePost, logout, publishPostExternalCall};