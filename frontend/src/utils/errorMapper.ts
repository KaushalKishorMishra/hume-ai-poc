import { AppError } from "../types";
import { ErrorReason } from "../types/interview";

export type { AppError };

interface VoiceError {
  message?: string;
  code?: string | number;
}

export interface MappedError extends AppError {
  reason: ErrorReason;
}

export const mapVoiceError = (error: VoiceError | Error | unknown): MappedError => {
  console.error("Voice SDK Error Caught:", error);

  const errMsg = (error as VoiceError)?.message?.toLowerCase() || "";
  const errCode = (error as VoiceError)?.code;

  // 1. Microphone / Permissions
  if (errMsg.includes("not allowed") || errMsg.includes("permission") || errMsg.includes("denied")) {
    return {
      type: "Microphone",
      message: "Microphone access was denied. Please allow access in your browser settings.",
      action: "CheckSettings",
      reason: ErrorReason.MICROPHONE_ERROR,
    };
  }

  // 2. Browser Compatibility
  if (errMsg.includes("audio context") || errMsg.includes("not supported") || errMsg.includes("webrtc")) {
    return {
      type: "System",
      message: "Your browser does not support the audio features required for this interview.",
      action: "ContactSupport",
      reason: ErrorReason.UNKNOWN,
    };
  }

  // 3. Network / Socket / Connection
  if (
    errMsg.includes("socket") ||
    errMsg.includes("connection") ||
    errMsg.includes("network") ||
    errMsg.includes("websocket") ||
    errMsg.includes("failed to fetch") ||
    errMsg.includes("timeout")
  ) {
    return {
      type: "Network",
      message: "Connection to the interview server was lost. Please check your internet connection.",
      action: "Retry",
      reason: ErrorReason.NETWORK_ERROR,
    };
  }

  // 4. Auth / Token
  if (
    errMsg.includes("401") ||
    errMsg.includes("unauthorized") ||
    errMsg.includes("token") ||
    errMsg.includes("expired") ||
    errCode === 401
  ) {
    return {
      type: "Auth",
      message: "Your session has expired. Please refresh the page to start a new session.",
      action: "Refresh",
      reason: ErrorReason.AUTH_ERROR,
    };
  }

  // 5. Rate Limit / Concurrent Sessions
  if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("concurrent") || errCode === 429) {
    return {
      type: "System",
      message: "Too many active interviews. Please try again in a few minutes.",
      action: "Retry",
      reason: ErrorReason.CONCURRENT_LIMIT_EXCEEDED,
    };
  }

  // 6. Server Error
  if (errMsg.includes("500") || errMsg.includes("server error") || errCode === 500) {
    return {
      type: "System",
      message: "The interview server encountered an error. Please try again.",
      action: "Retry",
      reason: ErrorReason.SERVER_ERROR,
    };
  }

  // Default
  return {
    type: "System",
    message: "An unexpected error occurred: " + ((error as VoiceError)?.message || "Unknown error"),
    action: "Retry",
    reason: ErrorReason.UNKNOWN,
  };
};

// Map error reason to user-friendly message
export const getErrorReasonMessage = (reason: ErrorReason): string => {
  switch (reason) {
    case ErrorReason.NETWORK_ERROR:
      return "Lost connection to the server";
    case ErrorReason.AUTH_ERROR:
      return "Session authentication failed";
    case ErrorReason.MICROPHONE_ERROR:
      return "Microphone access was blocked";
    case ErrorReason.TAB_CLOSED:
      return "Browser tab was closed";
    case ErrorReason.CONCURRENT_LIMIT_EXCEEDED:
      return "Maximum concurrent interviews reached";
    case ErrorReason.SERVER_ERROR:
      return "Server encountered an error";
    case ErrorReason.SESSION_TIMEOUT:
      return "Session timed out due to inactivity";
    default:
      return "An unexpected error occurred";
  }
};
