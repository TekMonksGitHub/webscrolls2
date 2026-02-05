/**
 * Runs AI with the given prompt. This should be setup as a long
 * running API.
 * 
 * Params
 * 	prompt: The prompt
 *  
 * (C) 2025 TekMonks. All rights reserved.
 */

const yaml = require("yaml");
const OpenAI = require("openai");
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
    
    let retry = 0, response;
    LOG.info(`Servicing a new AI request`);
    while (retry < 3) {
        response = (await client.responses.create({
            model: conf.model, 
            instructions: conf.systemprompt, 
            input: jsonReq.prompt,
            tools: [{"type": "web_search"}],
        }))?.output_text;
        if (response?.split(conf.separator).length !== 3) retry++; else break;
    }
    if (retry == 3) { LOG.info(`AI failed to process the request`); return CONSTANTS.FALSE_RESULT; }  // ai failed

    const [html, schema, post] = response.split(conf.separator);
    LOG.info(`Returning the response`);
    return {airesponse: response.output_text, html, schema, post, ...CONSTANTS.TRUE_RESULT};
}

const validateRequest = jsonReq => (jsonReq && jsonReq.prompt);
