/**
 * Runs AI with the given prompt. This should be setup as a long
 * running API. Handles both post and theme generation via AI.
 * 
 * Params
 * 	prompt: The prompt. By default assumes it is a theme generation prompt. 
 *  postschema: Optional: If provided, assumes it is a post generation prompt for this schema.
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const yaml = require("yaml");
const OpenAI = require("openai");
const mustache = require("mustache");
const fspromises = require("fs").promises;
const crypt = require(`${CONSTANTS.LIBDIR}/crypt.js`);

let conf, client;

async function _init() {
    const rawConf = await fspromises.readFile(`${WEBSCROLLS_CONSTANTS.CONF_DIR}/ai.yaml`, "utf8");
    conf = yaml.parse(rawConf);
    conf.real_aikey = await crypt.decrypt(conf.ai_key, conf.crypt_key);
    conf.separator = conf.separator.trim();
    client = new OpenAI({apiKey: conf.real_aikey});
}

exports.doService = async jsonReq => {
    if (!validateRequest(jsonReq)) {LOG.error(`Validation failure for AI call.`); return CONSTANTS.FALSE_RESULT;}

    if (!conf) await _init();
    
    LOG.info(`Servicing a new AI ${jsonReq.postschema?"post":"theme"} request`);
    if (jsonReq.postschema) return returnPostContent(jsonReq);
    else return returnThemeContent(jsonReq);
}

async function returnThemeContent(jsonReq) {
    let retry = 0; response, error;
    while (retry < 3) {
        retry++;
        if (retry > 0) LOG.info(`Retrying AI request.`);
        try {
            const prompt = mustache.render(conf.contextprompt_theme_template, {prompt: jsonReq.prompt, error}).trim();
            response = (await client.responses.create({
                model: conf.model, 
                instructions: conf.systemprompt_theme, 
                input: prompt,
                tools: [{"type": "web_search"}],
            }));
        } catch (err) {LOG.error(`Bad response from AI. OpenAI error ${err}`); continue;}

        // check response for correctness
        if (response?.output_text.split(conf.separator).length !== 3) {
            error = `${response?.output_text}\nNot following the specified response structure.`;
            LOG.error(`Response ${JSON.stringify(response)} is bad. Not following the specified response structure.`);
            continue; 
        }
        
        break;  // reaching here means it is a good response
    }
    if (retry == 3) { LOG.info(`AI failed to process the theme generation request. Returning false.`); return CONSTANTS.FALSE_RESULT; }  // ai failed

    LOG.info("Returning the response, good AI response.");
    const [html, schema, post] = response.output_text.split(conf.separator);
    return {airesponse: response, html, schema, post, ...CONSTANTS.TRUE_RESULT};
}

async function returnPostContent(jsonReq) {
    let retry = 0, response, error;
    outerloop: while (retry < 3) {
        retry++;
        if (retry > 0) LOG.info(`Retrying AI request.`);
        try { 
            const prompt = mustache.render(conf.contextprompt_post_template, {
                prompt: jsonReq.prompt, postschema: JSON.stringify(jsonReq.postschema, null, 2), error}).trim();
            response = (await client.responses.create({
                model: conf.model, 
                instructions: conf.systemprompt_post, 
                input: prompt,
                tools: [{"type": "web_search"}],
            }));
        } catch (err) {LOG.error(`Bad response from AI. OpenAI error ${err}`); continue;}

        // check response is good 
        let responseObject; try {responseObject = yaml.parse(response?.output_text)} catch (err) {
            error = `${response?.output_text}\nHas error ${err}`;
            LOG.error(`Bad response ${JSON.stringify(response)} from AI, unparsable YAML. Error is ${err}`); continue; 
        }
        for (const key of Object.keys(jsonReq.postschema)) if ((!responseObject[key]) && (!key.endsWith("-schema"))) {
            error = `${response?.output_text}\nMissing schema key ${key}`;
            LOG.error(`Bad response from AI. Missing schema key ${key}`); continue outerloop; 
        } 
        
        break;   // reaching here means it is a good response
    }
    if (retry == 3) { LOG.info(`AI failed to process the post generation request. Returning false.`); return CONSTANTS.FALSE_RESULT; }  // ai failed

    LOG.info(`Returning the response, good AI response.`);
    return {post: response.output_text, ...CONSTANTS.TRUE_RESULT};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.prompt);