import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { HttpError } from "../errors.js";

export const DEFAULT_MODEL_CONSTRUCTORS = { local: ChatOllama, gemini: ChatGoogleGenerativeAI, openai: ChatOpenAI, anthropic: ChatAnthropic };
/** @param {Record<string,any>} model @param {ReturnType<typeof import("./catalog.js").createModelCatalog>} catalog @param {ReturnType<typeof import("../config.js").createConfig>} config @param {Record<string,any>} [constructors] */
export function makeChatModel(model,catalog,config,constructors=DEFAULT_MODEL_CONSTRUCTORS){const provider=String(model.provider??"");const Constructor=constructors[provider];if(!Constructor)throw new HttpError(400,"Unsupported provider");const key=provider==="local"?null:catalog.getProviderKey(provider);if(provider!=="local"&&!key)throw new HttpError(400,`API key is not configured for ${provider}`);try{if(provider==="local")return new Constructor({model:model.model,baseUrl:config.ollamaBaseUrl,temperature:0.3});if(provider==="gemini")return new Constructor({model:model.model,apiKey:key,temperature:0.3});if(provider==="openai")return new Constructor({model:model.model,apiKey:key,temperature:0.3});return new Constructor({model:model.model,apiKey:key,temperature:0.3,maxTokens:4096});}catch(error){throw new HttpError(500,`Could not initialize ${provider} model`,{cause:error});}}
