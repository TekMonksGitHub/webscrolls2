/**
 * Runs AI with the given prompt.
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
    if (!conf) await _init();
    
    let retry = 0, response;
    while (retry < 3) {
        response = (await client.responses.create({
            model: conf.model, 
            instructions: conf.systemprompt, 
            input: jsonReq.prompt,
            tools: [{"type": "web_search"}],
        }))?.output_text;
        if (response?.split(conf.separator).length !== 3) retry++; else break;
    }
    if (retry == 3) return CONSTANTS.FALSE_RESULT;  // ai failed

    const [html, schema, post] = response.split(conf.separator);
    return {airesponse: response.output_text, html, schema, post, ...CONSTANTS.TRUE_RESULT};
}