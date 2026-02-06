import axios, { AxiosError } from "axios";
import { SessionSetup, VoiceMessage } from "../types";
import { SessionCapacity } from "../types/interview";

const BACKEND_URL = "http://localhost:3001";

export type { SessionSetup };

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

// Setup session - get access token and config ID
export const setupSession = async (): Promise<SessionSetup> => {
  try {
    const response = await axios.post<SessionSetup>(`${BACKEND_URL}/api/session/setup`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    console.error("Session Setup Failed:", axiosError.response?.data || axiosError.message);
    throw new Error(axiosError.response?.data?.error || "Failed to setup session");
  }
};

// Check session capacity before starting
export const checkCapacity = async (): Promise<SessionCapacity> => {
  try {
    const response = await axios.get<SessionCapacity>(`${BACKEND_URL}/api/session/capacity`);
    return response.data;
  } catch (error) {
    console.error("Capacity check failed:", error);
    // Return allowed: true as fallback to not block users if endpoint fails
    return { allowed: true, activeCount: 0, limit: 5 };
  }
};

// Start a session (reserves a concurrent slot)
export const startSession = async (sessionId: string, totalQuestions: number): Promise<boolean> => {
  try {
    await axios.post(`${BACKEND_URL}/api/session/start`, { sessionId, totalQuestions });
    return true;
  } catch (error) {
    const axiosError = error as AxiosError<ApiErrorResponse & SessionCapacity>;
    if (axiosError.response?.status === 429) {
      throw new Error(axiosError.response.data?.message || "Concurrent session limit reached");
    }
    console.error("Start session failed:", error);
    return false;
  }
};

// End a session (releases the concurrent slot)
export const endSession = async (sessionId: string): Promise<void> => {
  try {
    await axios.post(`${BACKEND_URL}/api/session/end`, { sessionId });
  } catch (error) {
    console.error("End session failed:", error);
  }
};

// Send heartbeat to keep session alive
export const sendHeartbeat = async (sessionId: string): Promise<void> => {
  try {
    await axios.post(`${BACKEND_URL}/api/session/heartbeat`, { sessionId });
  } catch (error) {
    console.error("Heartbeat failed:", error);
  }
};

// Interview record for saving
interface SaveInterviewRequest {
  chatGroupId: string;
  transcript: VoiceMessage[];
  status: 'COMPLETED' | 'ERROR';
  disconnectReason: string;
  totalQuestions: number;
  durationMs: number;
  errorReason?: string;
}

// Save interview record with full details
export const saveInterviewRecord = async (record: SaveInterviewRequest): Promise<void> => {
  try {
    await axios.post(`${BACKEND_URL}/api/session/record`, record);
  } catch (error) {
    console.error("Failed to save interview record:", error);
  }
};

// Legacy - simple save (for backwards compatibility)
export const saveSession = async (chatGroupId: string, transcript: VoiceMessage[]): Promise<void> => {
  try {
    await axios.post(`${BACKEND_URL}/api/session/record`, {
      chatGroupId,
      transcript,
      status: 'COMPLETED',
      disconnectReason: 'completed',
      totalQuestions: 0,
      durationMs: 0,
    });
  } catch (error) {
    console.error("Failed to save session:", error);
  }
};

// Get active sessions (for admin/debug)
export const getActiveSessions = async (): Promise<{ sessions: unknown[]; activeCount: number; limit: number }> => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/session/active`);
    return response.data;
  } catch (error) {
    console.error("Failed to get active sessions:", error);
    return { sessions: [], activeCount: 0, limit: 5 };
  }
};
