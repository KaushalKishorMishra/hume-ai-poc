import axios from "axios";

const BACKEND_URL = "http://localhost:3001";

export interface SessionSetup {
  accessToken: string;
  configId: string;
}

export const setupSession = async (): Promise<SessionSetup> => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/session/setup`);
    return response.data;
  } catch (error: any) {
    console.error("Session Setup Failed:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error || "Failed to setup session");
  }
};
