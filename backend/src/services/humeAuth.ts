import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export interface AuthResult {
  accessToken?: string;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
}

/**
 * Exchanges the Server-Side Secret Key for a Client-Side Access Token.
 * This ensures the Secret Key never leaves this server.
 */
export const getHumeAccessToken = async (): Promise<AuthResult> => {
  const apiKey = process.env.HUME_API_KEY;
  const secretKey = process.env.HUME_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return {
      error: {
        code: 500,
        message: "Server Configuration Error: Missing Hume Credentials",
      },
    };
  }

  try {
    // Direct API Call to Hume Auth Service via Axios
    // Basic Auth: base64(apiKey:secretKey)
    const authHeader = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
    
    const response = await axios.post(
      "https://api.hume.ai/oauth2-cc/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authHeader}`,
        },
      }
    );

    const accessToken = response.data.access_token;

    if (!accessToken) {
      return {
        error: {
          code: 502,
          message: "Upstream Error: Received empty token from Hume",
        },
      };
    }

    return { accessToken };
  } catch (err: any) {
    // Detailed Error Mapping
    console.error("Hume Auth Exception:", err.response?.data || err.message);

    const statusCode = err.response?.status;

    if (statusCode === 401) {
      return { error: { code: 401, message: "Hume API: Invalid API Key or Secret" } };
    }
    
    if (statusCode === 429) {
        return { error: { code: 429, message: "Hume API: Rate Limit / Quota Exceeded" } };
    }

    return {
      error: {
        code: statusCode || 500,
        message: "Hume API Auth Error",
        details: err.response?.data?.error_description || err.message,
      },
    };
  }
};
