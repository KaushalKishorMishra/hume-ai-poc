import { useEffect, useRef, useCallback } from "react";
import { useVoice, VoiceReadyState } from "@humeai/voice-react";
import { Mic, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { mapVoiceError, MappedError } from "../utils/errorMapper";
import { saveInterviewRecord, endSession, sendHeartbeat, checkCapacity, startSession } from "../api/session";
import { VoiceMessage, ChatMetadata } from "../types";
import { InterviewStage, ErrorReason } from "../types/interview";
import { useBeforeUnload } from "../hooks/useBeforeUnload";
import { UseInterviewStateReturn } from "../hooks/useInterviewState";

interface VoiceChatProps {
  accessToken: string;
  configId: string;
  interview: UseInterviewStateReturn;
  onError: (error: MappedError) => void;
}

interface VoiceHook {
  connect: (options: ConnectOptions) => Promise<void>;
  disconnect: () => void;
  readyState: VoiceReadyState;
  isPlaying: boolean;
  messages: VoiceMessage[];
  error: Error | null;
  sendUserInput: (text: string) => void;
  chatMetadata: ChatMetadata | null;
}

interface ConnectOptions {
  auth: { type: "accessToken"; value: string };
  configId: string;
  hostname: string;
  sessionSettings?: {
    variables?: Record<string, string>;
  };
}

const INTERVIEW_QUESTIONS = [
  "Tell me about your most challenging project.",
  "How do you stay updated with the latest technology trends?",
  "Describe a time you had to learn something very quickly.",
];

export const VoiceChat = ({ accessToken, configId, interview, onError }: VoiceChatProps) => {
  const { state, actions } = interview;
  const {
    connect,
    disconnect,
    readyState,
    isPlaying,
    messages,
    error,
    sendUserInput,
    chatMetadata,
  } = useVoice() as VoiceHook;

  const hasStartedRef = useRef(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesRef = useRef<VoiceMessage[]>([]);

  // Keep messages ref updated for beforeunload
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Setup beforeunload handler - only for tab close (real network issue)
  useBeforeUnload(
    useCallback(() => {
      if (state.stage === InterviewStage.IN_PROGRESS || state.stage === InterviewStage.READY) {
        return {
          sessionId: state.sessionId,
          transcript: messagesRef.current,
          durationMs: state.timestamps.startedAt ? Date.now() - state.timestamps.startedAt : 0,
        };
      }
      return null;
    }, [state.stage, state.sessionId, state.timestamps.startedAt])
  );

  // Handle voice SDK errors - only network/system errors
  useEffect(() => {
    if (error) {
      const mappedError = mapVoiceError(error);
      actions.disconnect('error', mappedError.reason, mappedError.message);
      onError(mappedError);
    }
  }, [error, actions, onError]);

  // Sync with voice readyState
  useEffect(() => {
    if (readyState === VoiceReadyState.OPEN && state.stage === InterviewStage.CONNECTING) {
      const sessionId = chatMetadata?.chatGroupId || `session-${Date.now()}`;
      actions.connectionSuccess(sessionId);

      // Start heartbeat to keep session alive
      heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat(sessionId);
      }, 30000);
    }

    // Handle unexpected disconnection (network error)
    if (readyState === VoiceReadyState.CLOSED && 
        state.stage !== InterviewStage.IDLE && 
        state.stage !== InterviewStage.COMPLETED && 
        state.stage !== InterviewStage.ERROR) {
      if (state.disconnectReason !== 'completed') {
        console.error("⚠️ Unexpected disconnection - network error");
        actions.disconnect('error', ErrorReason.NETWORK_ERROR, 'Connection was closed unexpectedly');
        
        // Save as error
        const sessionId = state.sessionId || `session-${Date.now()}`;
        saveInterviewRecord({
          chatGroupId: sessionId,
          transcript: messagesRef.current,
          status: 'ERROR',
          disconnectReason: 'error',
          totalQuestions: INTERVIEW_QUESTIONS.length,
          durationMs: state.timestamps.startedAt ? Date.now() - state.timestamps.startedAt : 0,
          errorReason: ErrorReason.NETWORK_ERROR,
        });
      }
    }
  }, [readyState, state.stage, state.disconnectReason, chatMetadata, actions, state.sessionId, state.timestamps.startedAt]);

  // Auto-start interview when connected
  useEffect(() => {
    if (readyState === VoiceReadyState.OPEN && !hasStartedRef.current && state.stage === InterviewStage.READY) {
      setTimeout(() => {
        if (sendUserInput && readyState === VoiceReadyState.OPEN) {
          console.log("🎬 Triggering Interview Start...");
          sendUserInput("Start the interview");
          hasStartedRef.current = true;
          actions.interviewStarted();
        }
      }, 1000);
    }
    if (readyState !== VoiceReadyState.OPEN) {
      hasStartedRef.current = false;
    }
  }, [readyState, sendUserInput, state.stage, actions]);

  // Listen for interview completion signal from Hume
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const content = lastMsg.message?.content || "";
    const contentUpper = content.toUpperCase();

    // Only end when Hume sends the completion signal
    if (lastMsg.type === "assistant_message" && contentUpper.includes("END_INTERVIEW_SESSION")) {
      console.log("🏁 Interview Completed. Saving & Disconnecting...");
      handleInterviewComplete();
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  const handleInterviewComplete = async () => {
    actions.interviewCompleted();
    disconnect();

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    const sessionId = state.sessionId || chatMetadata?.chatGroupId || `session-${Date.now()}`;

    actions.startSaving();
    await saveInterviewRecord({
      chatGroupId: sessionId,
      transcript: messages,
      status: 'COMPLETED',
      disconnectReason: 'completed',
      totalQuestions: INTERVIEW_QUESTIONS.length,
      durationMs: state.timestamps.startedAt ? Date.now() - state.timestamps.startedAt : 0,
    });
    await endSession(sessionId);
    actions.saveComplete();
  };

  const handleStart = async () => {
    // Check capacity first
    actions.capacityCheckStart();
    const capacity = await checkCapacity();

    if (!capacity.allowed) {
      actions.capacityCheckFailed(capacity.message || "Maximum concurrent interviews reached");
      return;
    }

    // Start connecting
    actions.startConnecting(INTERVIEW_QUESTIONS.length);

    const questionsStr = INTERVIEW_QUESTIONS.join("\n");
    const tempSessionId = `session-${Date.now()}`;

    try {
      // Reserve the session slot
      await startSession(tempSessionId, INTERVIEW_QUESTIONS.length);

      await connect({
        auth: { type: "accessToken", value: accessToken },
        configId: configId,
        hostname: "api.hume.ai",
        sessionSettings: {
          variables: {
            questions_list: questionsStr,
          },
        },
      });

      console.log("✅ Session Started with dynamic questions");
    } catch (err) {
      console.error("Connect Failure:", err);
      const mappedError = mapVoiceError(err);
      actions.connectionFailed(mappedError.reason, mappedError.message);
      await endSession(tempSessionId);
      onError(mappedError);
    }
  };

  const isConnecting = state.loading.isConnecting || readyState === VoiceReadyState.CONNECTING;
  const isConnected = readyState === VoiceReadyState.OPEN;
  const isThinking = isPlaying;
  const isCheckingCapacity = state.loading.isCheckingCapacity;
  const isSaving = state.loading.isSaving;
  const isInterviewInProgress = state.stage === InterviewStage.IN_PROGRESS || state.stage === InterviewStage.READY;

  // Render status indicator
  const renderStatusIndicator = () => {
    if (state.stage === InterviewStage.COMPLETED) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle size={20} />
          <span className="font-medium">Interview Completed</span>
        </div>
      );
    }

    if (state.stage === InterviewStage.ERROR) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle size={20} />
          <span className="font-medium">Connection Error</span>
        </div>
      );
    }

    if (isCheckingCapacity) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Checking availability...</span>
        </div>
      );
    }

    if (isConnecting) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Connecting to Interviewer...</span>
        </div>
      );
    }

    if (isSaving) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Saving interview...</span>
        </div>
      );
    }

    if (isConnected) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div
            className={`w-4 h-4 rounded-full ${isThinking ? "bg-purple-500 animate-bounce" : "bg-blue-500 animate-pulse"}`}
          />
          <span className="text-sm font-medium text-gray-700">
            {isThinking ? "Interviewer Speaking..." : "Listening..."}
          </span>
          <span className="text-xs text-gray-400">Interview in progress</span>
        </div>
      );
    }

    return <span className="text-gray-400">Ready for Interview</span>;
  };

  const canStartNew = state.stage === InterviewStage.COMPLETED || state.stage === InterviewStage.ERROR;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl shadow-lg w-full max-w-md mx-auto mt-10">
      {/* Status Indicator */}
      <div className="mb-8 text-center">{renderStatusIndicator()}</div>

      {/* Main Button - Only for starting, disabled during interview */}
      <button
        onClick={canStartNew ? () => actions.reset() : handleStart}
        disabled={isConnecting || isCheckingCapacity || isSaving || isInterviewInProgress}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          isInterviewInProgress
            ? "bg-gray-400 cursor-not-allowed"
            : canStartNew
              ? "bg-green-500 hover:bg-green-600 shadow-green-200"
              : "bg-black hover:bg-gray-800 shadow-gray-300"
        } shadow-xl text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isConnecting || isCheckingCapacity || isSaving ? (
          <Loader2 className="animate-spin w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>

      {/* Button Label */}
      <span className="mt-2 text-xs text-gray-500">
        {isInterviewInProgress 
          ? "Interview in progress..." 
          : canStartNew 
            ? "Start New Interview" 
            : "Start Interview"}
      </span>

      {/* Transcript */}
      <div className="mt-8 w-full border-t pt-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Interview Transcript
        </h3>
        <div
          className="h-64 overflow-y-auto space-y-4 pr-2 custom-scrollbar"
          id="transcript-container"
        >
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm italic mt-10">
              Click Start to begin the interview.
            </div>
          )}
          {messages.map((msg, idx) => {
            if (msg.type !== "user_message" && msg.type !== "assistant_message") return null;
            if (msg.message.content?.includes("END_INTERVIEW_SESSION")) return null;

            const isUser = msg.type === "user_message";
            return (
              <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-gray-400 mb-1 px-1">
                  {isUser ? "You" : "Interviewer"}
                </span>
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? "bg-black text-white rounded-tr-none"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                  }`}
                >
                  {msg.message.content}
                </div>
              </div>
            );
          })}
          <div id="anchor" />
        </div>
      </div>
    </div>
  );
};
