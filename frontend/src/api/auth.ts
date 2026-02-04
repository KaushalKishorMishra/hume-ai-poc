import axios from "axios";

const BACKEND_URL = "http://localhost:3001";

export const fetchHumeToken = async (): Promise<string> => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/auth/token`, {}, {
      headers: {
        // Optional: Send a client ID if your backend requires it
        "x-client-app-id": "hume-poc-web" 
      }
    });
    
    return response.data.accessToken;
  } catch (error: any) {
    if (error.response) {
      // Backend returned a specific error (401, 429, 500)
      const code = error.response.status;
      const msg = error.response.data?.message || "Server Error";
      throw new Error(`Auth Failed (${code}): ${msg}`);
    } else if (error.request) {
      // Network timeout / Backend down
      throw new Error("Network Error: Could not reach authentication server.");
    }
    throw error;
  }
};
