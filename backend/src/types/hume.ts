// Hume API Types

export interface HumeConfig {
  id?: string;
  name: string;
  evi_version: string;
  prompt: {
    text: string;
  };
  voice: {
    provider: string;
    name: string;
  };
  tools: HumeTool[];
}

export interface HumeTool {
  type: string;
  name: string;
  parameters?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  fallback_content?: string;
  description?: string;
}

export interface HumePrompt {
  id?: string;
  name: string;
  text: string;
  version?: number;
  version_description?: string;
}

export interface HumeConfigsResponse {
  configs_page?: HumeConfig[];
}

export interface HumePromptsResponse {
  prompts_page?: HumePrompt[];
}

export interface HumeToolsResponse {
  tools_page?: HumeTool[];
}

export interface HumeChatGroup {
  id: string;
  first_start_timestamp: number;
  most_recent_start_timestamp: number;
  num_chats: number;
}

export interface HumeChatGroupsResponse {
  chat_groups_page?: HumeChatGroup[];
}

export interface PaginationParams {
  page_number?: number;
  page_size?: number;
}

export interface ApiError {
  code: number;
  message: string;
  details?: unknown;
}
