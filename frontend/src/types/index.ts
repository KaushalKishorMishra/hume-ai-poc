import { ErrorReason } from './interview';

export interface AppError {
  type: "Network" | "Auth" | "Microphone" | "System";
  message: string;
  action: "Retry" | "Refresh" | "CheckSettings" | "ContactSupport";
  reason?: ErrorReason;
}

export interface SessionSetup {
  accessToken: string;
  configId: string;
}

export interface VoiceMessage {
  type: "user_message" | "assistant_message" | "system_message";
  message: {
    content: string;
    role?: string;
  };
}

export interface ChatMetadata {
  chatGroupId?: string;
  chatId?: string;
}
