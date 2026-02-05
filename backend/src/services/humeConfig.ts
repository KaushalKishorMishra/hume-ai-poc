import axios, { AxiosError } from "axios";
import dotenv from "dotenv";

dotenv.config();

const HUME_API_BASE = "https://api.hume.ai/v0/evi";

const getClient = () => {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) throw new Error("HUME_API_KEY is not defined");

  const client = axios.create({
    baseURL: HUME_API_BASE,
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((config) => {
    const fullUrl = `${config.baseURL}${config.url?.startsWith("/") ? "" : "/"}${config.url}`;
    console.log(`🚀 [Hume API] ${config.method?.toUpperCase()} ${fullUrl}`, config.data || "");
    return config;
  });

  return client;
};

// --- Configs ---

export const createConfig = (data: any) => getClient().post("/configs", data).then(r => r.data).catch(handleError);
export const listConfigs = (params?: any) => getClient().get("/configs", { params }).then(r => r.data).catch(handleError);
export const getConfig = (id: string) => getClient().get(`/configs/${id}`).then(r => r.data).catch(handleError);
export const deleteConfig = (id: string) => getClient().delete(`/configs/${id}`).then(r => r.data).catch(handleError);
export const updateConfig = (id: string, data: any) => getClient().patch(`/configs/${id}`, data).then(r => r.data).catch(handleError);
export const updateConfigName = (id: string, name: string) => getClient().patch(`/configs/${id}`, { name }).then(r => r.data).catch(handleError);

// Config Versions
export const listConfigVersions = (id: string, params?: any) => getClient().get(`/configs/${id}`, { params }).then(r => r.data).catch(handleError);
export const createConfigVersion = (id: string, data: any) => getClient().post(`/configs/${id}`, data).then(r => r.data).catch(handleError);
export const getConfigVersion = (id: string, version: number) => getClient().get(`/configs/${id}/version/${version}`).then(r => r.data).catch(handleError);
export const updateConfigDescription = (id: string, version: number, description: string) => 
    getClient().patch(`/configs/${id}/version/${version}`, { version_description: description }).then(r => r.data).catch(handleError);
export const deleteConfigVersion = (id: string, version: number) => getClient().delete(`/configs/${id}/version/${version}`).then(r => r.data).catch(handleError);


// --- Prompts ---

export const createPrompt = (data: any) => getClient().post("/prompts", data).then(r => r.data).catch(handleError);
export const listPrompts = (params?: any) => getClient().get("/prompts", { params }).then(r => r.data).catch(handleError);
export const deletePrompt = (id: string) => getClient().delete(`/prompts/${id}`).then(r => r.data).catch(handleError);
export const updatePromptName = (id: string, name: string) => getClient().patch(`/prompts/${id}`, { name }).then(r => r.data).catch(handleError);

// Prompt Versions
export const listPromptVersions = (id: string, params?: any) => getClient().get(`/prompts/${id}`, { params }).then(r => r.data).catch(handleError);
export const createPromptVersion = (id: string, data: any) => getClient().post(`/prompts/${id}`, data).then(r => r.data).catch(handleError);
export const getPromptVersion = (id: string, version: number) => getClient().get(`/prompts/${id}/version/${version}`).then(r => r.data).catch(handleError);
export const updatePromptDescription = (id: string, version: number, description: string) => 
    getClient().patch(`/prompts/${id}/version/${version}`, { version_description: description }).then(r => r.data).catch(handleError);
export const deletePromptVersion = (id: string, version: number) => getClient().delete(`/prompts/${id}/version/${version}`).then(r => r.data).catch(handleError);


// --- Tools ---

export const createTool = (data: any) => getClient().post("/tools", data).then(r => r.data).catch(handleError);
export const listTools = (params?: any) => getClient().get("/tools", { params }).then(r => r.data).catch(handleError);
export const deleteTool = (id: string) => getClient().delete(`/tools/${id}`).then(r => r.data).catch(handleError);
export const updateToolName = (id: string, name: string) => getClient().patch(`/tools/${id}`, { name }).then(r => r.data).catch(handleError);

// Tool Versions
export const listToolVersions = (id: string, params?: any) => getClient().get(`/tools/${id}`, { params }).then(r => r.data).catch(handleError);
export const createToolVersion = (id: string, data: any) => getClient().post(`/tools/${id}`, data).then(r => r.data).catch(handleError);
export const getToolVersion = (id: string, version: number) => getClient().get(`/tools/${id}/version/${version}`).then(r => r.data).catch(handleError);
export const updateToolDescription = (id: string, version: number, description: string) => 
    getClient().patch(`/tools/${id}/version/${version}`, { version_description: description }).then(r => r.data).catch(handleError);
export const deleteToolVersion = (id: string, version: number) => getClient().delete(`/tools/${id}/version/${version}`).then(r => r.data).catch(handleError);


// --- Chats ---

export const listChatGroups = (params?: any) => getClient().get("/chat_groups", { params }).then(r => r.data).catch(handleError);


const handleError = (error: any) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    throw {
      code: axiosError.response?.status || 500,
      message: axiosError.response?.statusText || axiosError.message,
      details: axiosError.response?.data,
    };
  }
  throw error;
};