import axios, { AxiosError } from "axios";
import dotenv from "dotenv";

dotenv.config();

// Base URL for Hume EVI API
const HUME_API_BASE = "https://api.hume.ai/v0/evi/configs";

// Helper to get configured Axios instance
const getClient = () => {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY is not defined in environment variables");
  }

  const client = axios.create({
    baseURL: HUME_API_BASE,
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  // Log outgoing requests for debugging
  client.interceptors.request.use((config) => {
    console.log(`🚀 Outgoing Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  });

  return client;
};

export const createConfig = async (configData: any) => {
  try {
    const response = await getClient().post("", configData);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const listConfigs = async (params?: any) => {
  try {
    const response = await getClient().get("", { params });
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const getConfig = async (id: string) => {
  try {
    const response = await getClient().get(`/${id}`);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const updateConfig = async (id: string, configData: any) => {
  try {
    // EVI Configs usually support PATCH for partial updates or PUT for replacement.
    // Using PATCH as it's safer for partials, but standard might be different.
    // If specific fields are needed, they can be passed in configData.
    const response = await getClient().patch(`/${id}`, configData);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const deleteConfig = async (id: string) => {
  try {
    const response = await getClient().delete(`/${id}`);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

const handleError = (error: any) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    // Log full error details for debugging
    console.error("Hume Config API Error Details:", {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message
    });
    
    throw {
      code: axiosError.response?.status || 500,
      message: axiosError.response?.statusText || axiosError.message || "Hume API Error",
      details: axiosError.response?.data,
    };
  }
  throw error;
};
