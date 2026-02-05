export interface AppError {
  type: "Network" | "Auth" | "Microphone" | "System";
  message: string;
  action: "Retry" | "Refresh" | "CheckSettings" | "ContactSupport";
}

export const mapVoiceError = (error: any): AppError => {
  console.error("Voice SDK Error Caught:", error); // Added logging
  const errMsg = error?.message?.toLowerCase() || "";

  // 1. Microphone / Permissions
  if (errMsg.includes("not allowed") || errMsg.includes("permission")) {
    return {
      type: "Microphone",
      message: "Microphone access was denied. Please allow access in your browser settings.",
      action: "CheckSettings",
    };
  }
  
  // 2. Browser Compatibility
  if (errMsg.includes("audio context") || errMsg.includes("supported")) {
    return {
      type: "System",
      message: "Your browser does not support web audio features required for this demo.",
      action: "ContactSupport",
    };
  }

  // 3. Network / Socket
  if (errMsg.includes("socket") || errMsg.includes("connection") || errMsg.includes("network")) {
    return {
      type: "Network",
      message: "Connection to Hume Voice server was lost.",
      action: "Retry",
    };
  }

  // 4. Auth / Token
  if (errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("token")) {
    return {
      type: "Auth",
      message: "Session expired or invalid. Please refresh the page.",
      action: "Refresh",
    };
  }

  // Default
  return {
    type: "System",
    message: "An unexpected error occurred: " + (error?.message || "Unknown"),
    action: "Retry",
  };
};
