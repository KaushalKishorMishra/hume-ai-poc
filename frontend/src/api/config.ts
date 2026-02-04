import axios from "axios";

const BACKEND_URL = "http://localhost:3001";

export interface HumeConfig {
  id: string;
  version: number;
  description?: string;
  evi_version?: string;
  name?: string;
}

export const fetchConfigs = async (): Promise<HumeConfig[]> => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/configs`);
    // Handle both direct array or paginated response structure
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.configs)) return data.configs;
    return [];
  } catch (error) {
    console.error("Failed to fetch configs:", error);
    throw error;
  }
};
