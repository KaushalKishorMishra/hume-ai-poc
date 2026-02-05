import { useEffect, useRef } from "react";
import { useVoice, VoiceReadyState } from "@humeai/voice-react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { mapVoiceError, AppError } from "../utils/errorMapper";
import { saveSession } from "../api/session";

interface VoiceChatProps {
  onError: (err: AppError) => void;
  accessToken: string;
  configId: string;
}

export const VoiceChat = ({ onError, accessToken, configId }: VoiceChatProps) => {
  // @ts-ignore - useVoice definition might be missing new fields in this env
  const { connect, disconnect, readyState, isPlaying, messages, error, sendUserInput, chatMetadata } = useVoice();
  const hasStartedRef = useRef(false);

  // Watch for SDK internal errors and map them
  useEffect(() => {
    if (error) {
        onError(mapVoiceError(error));
    }
  }, [error, onError]);

  // Handle Connection State Visuals
  const isConnecting = readyState === VoiceReadyState.CONNECTING;
  const isConnected = readyState === VoiceReadyState.OPEN;

  // Simple status based on SDK properties
  const isThinking = isPlaying; 

  // 1. Trigger Initial Greeting
  useEffect(() => {
    if (isConnected && !hasStartedRef.current) {
        // Give a bit more time to ensure socket is stable
        setTimeout(() => {
            if (sendUserInput && readyState === VoiceReadyState.OPEN) {
                console.log("Triggering Interview Start...");
                sendUserInput("Start the interview");
                hasStartedRef.current = true;
            }
        }, 1000);
    }
    if (!isConnected) {
        hasStartedRef.current = false;
    }
  }, [isConnected, sendUserInput, readyState]);

  // 2. Watch for Text Signal (End Interview)
  useEffect(() => {
    if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        
        // Check for specific termination phrase from the assistant (Case-insensitive)
        // Ensure lastMsg.message exists to avoid TypeError
        const content = (lastMsg as any).message?.content?.toUpperCase() || "";
        if (lastMsg.type === "assistant_message" && content.includes("END_INTERVIEW_SESSION")) {
            console.log("🏁 Interview Finished (Signal Received). Saving & Disconnecting...");
            
            // Disconnect first to stop audio
            disconnect();
            
            // Save Session
            const chatId = chatMetadata?.chatGroupId || `session-${Date.now()}`;
            saveSession(chatId, messages);
        }
    }
  }, [messages, disconnect, chatMetadata]);

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      // Define the questions dynamically here
      const questions = [
        "Tell me about your most challenging project.",
        "How do you stay updated with the latest technology trends?",
        "Describe a time you had to learn something very quickly."
      ].join("\n");

      // Connect to EVI with required session parameters
      connect({
        auth: { type: "accessToken", value: accessToken },
        configId: configId,
        hostname: "api.hume.ai",
        sessionSettings: {
          variables: {
            questions_list: questions
          }
        },
        // Fallback for some versions
        // @ts-ignore
        session_settings: {
          variables: {
            questions_list: questions
          }
        }
      })
        .then(() => console.log("Session Started with dynamic questions"))
        .catch((err: any) => {
          console.error("Connect Failure:", err);
          onError(mapVoiceError(err));
        });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl shadow-lg w-full max-w-md mx-auto mt-10">
      
      {/* 1. Status Indicator */}
      <div className="mb-8 text-center">
        {isConnecting ? (
          <div className="flex items-center gap-2 text-blue-600">
             <Loader2 className="animate-spin" /> Connecting to Interviewer...
          </div>
        ) : isConnected ? (
          <div className="flex flex-col items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${isThinking ? "bg-purple-500 animate-bounce" : "bg-blue-500"}`} />
            <span className="text-sm font-medium text-gray-700">
               {isThinking ? "Interviewer Speaking..." : "Listening..."}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">Ready for Interview</span>
        )}
      </div>

      {/* 2. Main Action Button */}
      <button
        onClick={handleToggle}
        disabled={isConnecting}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          isConnected 
            ? "bg-red-500 hover:bg-red-600 shadow-red-200" 
            : "bg-black hover:bg-gray-800 shadow-gray-300"
        } shadow-xl text-white`}
      >
        {isConnecting ? (
           <Loader2 className="animate-spin w-6 h-6" />
        ) : isConnected ? (
           <MicOff className="w-6 h-6" />
        ) : (
           <Mic className="w-6 h-6" />
        )}
      </button>

      {/* 3. Real-time Transcript Log */}
      <div className="mt-8 w-full border-t pt-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Interview Transcript</h3>
        <div className="h-64 overflow-y-auto space-y-4 pr-2 custom-scrollbar" id="transcript-container">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm italic mt-10">
              Click Start to begin the interview.
            </div>
          )}
          {messages.map((msg: any, idx: number) => {
            if (msg.type !== "user_message" && msg.type !== "assistant_message") return null;
            
            // Hide the signal message from UI
            if (msg.message.content?.includes("END_INTERVIEW_SESSION")) return null;

            const isUser = msg.type === "user_message";
            return (
              <div 
                key={idx} 
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
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
