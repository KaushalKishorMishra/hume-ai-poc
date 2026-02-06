import axios, { AxiosError, AxiosInstance } from "axios";
import dotenv from "dotenv";
import {
  HumeConfig,
  HumeConfigsResponse,
  HumePrompt,
  HumePromptsResponse,
  HumeTool,
  HumeToolsResponse,
  HumeChatGroupsResponse,
  PaginationParams,
  ApiError,
} from "../types/hume";

dotenv.config();

const HUME_API_BASE = "https://api.hume.ai/v0/evi";

const getClient = (): AxiosInstance => {
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

const handleError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const apiError: ApiError = {
      code: axiosError.response?.status || 500,
      message: axiosError.response?.statusText || axiosError.message,
      details: axiosError.response?.data,
    };
    throw apiError;
  }
  throw error;
};

// --- Configs ---

export const createConfig = (data: Partial<HumeConfig>): Promise<HumeConfig> =>
  getClient().post<HumeConfig>("/configs", data).then(r => r.data).catch(handleError);

export const listConfigs = (params?: PaginationParams): Promise<HumeConfigsResponse> =>
  getClient().get<HumeConfigsResponse>("/configs", { params }).then(r => r.data).catch(handleError);

export const getConfig = (id: string): Promise<HumeConfigsResponse> =>
  getClient().get<HumeConfigsResponse>(`/configs/${id}`).then(r => r.data).catch(handleError);

export const deleteConfig = (id: string): Promise<void> =>
  getClient().delete(`/configs/${id}`).then(r => r.data).catch(handleError);

export const updateConfig = (id: string, data: Partial<HumeConfig>): Promise<HumeConfig> =>
  getClient().patch<HumeConfig>(`/configs/${id}`, data).then(r => r.data).catch(handleError);

export const updateConfigName = (id: string, name: string): Promise<HumeConfig> =>
  getClient().patch<HumeConfig>(`/configs/${id}`, { name }).then(r => r.data).catch(handleError);

// Config Versions
export const listConfigVersions = (id: string, params?: PaginationParams): Promise<HumeConfigsResponse> =>
  getClient().get<HumeConfigsResponse>(`/configs/${id}`, { params }).then(r => r.data).catch(handleError);

export const createConfigVersion = (id: string, data: Partial<HumeConfig>): Promise<HumeConfig> =>
  getClient().post<HumeConfig>(`/configs/${id}`, data).then(r => r.data).catch(handleError);

export const getConfigVersion = (id: string, version: number): Promise<HumeConfig> =>
  getClient().get<HumeConfig>(`/configs/${id}/version/${version}`).then(r => r.data).catch(handleError);

export const updateConfigDescription = (id: string, version: number, description: string): Promise<HumeConfig> =>
  getClient().patch<HumeConfig>(`/configs/${id}/version/${version}`, { version_description: description }).then(r => r.data).catch(handleError);

export const deleteConfigVersion = (id: string, version: number): Promise<void> =>
  getClient().delete(`/configs/${id}/version/${version}`).then(r => r.data).catch(handleError);

// --- Prompts ---

export const createPrompt = (data: Partial<HumePrompt>): Promise<HumePrompt> =>
  getClient().post<HumePrompt>("/prompts", data).then(r => r.data).catch(handleError);

export const listPrompts = (params?: PaginationParams): Promise<HumePromptsResponse> =>
  getClient().get<HumePromptsResponse>("/prompts", { params }).then(r => r.data).catch(handleError);

export const deletePrompt = (id: string): Promise<void> =>
  getClient().delete(`/prompts/${id}`).then(r => r.data).catch(handleError);

export const updatePromptName = (id: string, name: string): Promise<HumePrompt> =>
  getClient().patch<HumePrompt>(`/prompts/${id}`, { name }).then(r => r.data).catch(handleError);

// Prompt Versions
export const listPromptVersions = (id: string, params?: PaginationParams): Promise<HumePromptsResponse> =>
  getClient().get<HumePromptsResponse>(`/prompts/${id}`, { params }).then(r => r.data).catch(handleError);

export const createPromptVersion = (id: string, data: Partial<HumePrompt>): Promise<HumePrompt> =>
  getClient().post<HumePrompt>(`/prompts/${id}`, data).then(r => r.data).catch(handleError);

export const getPromptVersion = (id: string, version: number): Promise<HumePrompt> =>
  getClient().get<HumePrompt>(`/prompts/${id}/version/${version}`).then(r => r.data).catch(handleError);

export const updatePromptDescription = (id: string, version: number, description: string): Promise<HumePrompt> =>
  getClient().patch<HumePrompt>(`/prompts/${id}/version/${version}`, { version_description: description }).then(r => r.data).catch(handleError);

export const deletePromptVersion = (id: string, version: number): Promise<void> =>
  getClient().delete(`/prompts/${id}/version/${version}`).then(r => r.data).catch(handleError);

// --- Tools ---

export const createTool = (data: Partial<HumeTool>): Promise<HumeTool> =>
  getClient().post<HumeTool>("/tools", data).then(r => r.data).catch(handleError);

export const listTools = (params?: PaginationParams): Promise<HumeToolsResponse> =>
  getClient().get<HumeToolsResponse>("/tools", { params }).then(r => r.data).catch(handleError);

export const deleteTool = (id: string): Promise<void> =>
  getClient().delete(`/tools/${id}`).then(r => r.data).catch(handleError);

export const updateToolName = (id: string, name: string): Promise<HumeTool> =>
  getClient().patch<HumeTool>(`/tools/${id}`, { name }).then(r => r.data).catch(handleError);

// Tool Versions
export const listToolVersions = (id: string, params?: PaginationParams): Promise<HumeToolsResponse> =>
  getClient().get<HumeToolsResponse>(`/tools/${id}`, { params }).then(r => r.data).catch(handleError);

export const createToolVersion = (id: string, data: Partial<HumeTool>): Promise<HumeTool> =>
  getClient().post<HumeTool>(`/tools/${id}`, data).then(r => r.data).catch(handleError);

export const getToolVersion = (id: string, version: number): Promise<HumeTool> =>
  getClient().get<HumeTool>(`/tools/${id}/version/${version}`).then(r => r.data).catch(handleError);

export const updateToolDescription = (id: string, version: number, description: string): Promise<HumeTool> =>
  getClient().patch<HumeTool>(`/tools/${id}/version/${version}`, { version_description: description }).then(r => r.data).catch(handleError);

export const deleteToolVersion = (id: string, version: number): Promise<void> =>
  getClient().delete(`/tools/${id}/version/${version}`).then(r => r.data).catch(handleError);

// --- Chats ---

export const listChatGroups = (params?: PaginationParams): Promise<HumeChatGroupsResponse> =>
  getClient().get<HumeChatGroupsResponse>("/chat_groups", { params }).then(r => r.data).catch(handleError);
