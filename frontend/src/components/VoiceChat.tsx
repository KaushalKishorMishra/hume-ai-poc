import { useEffect } from "react";
import { useVoice, VoiceReadyState } from "@humeai/voice-react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { mapVoiceError, AppError } from "../utils/errorMapper";

export const VoiceChat = ({ onError }: { onError: (err: AppError) => void }) => {
  const { connect, disconnect, readyState, isPlaying, messages, error } = useVoice();

  // Watch for SDK internal errors and map them
  useEffect(() => {
    if (error) {
        // @ts-ignore - The SDK error type might be generic
        onError(mapVoiceError(error));
    }
  }, [error, onError]);

  // Handle Connection State Visuals
  const isConnecting = readyState === VoiceReadyState.CONNECTING;
  const isConnected = readyState === VoiceReadyState.OPEN;

  // Simple status based on SDK properties
  const isThinking = isPlaying; 

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      // Connect to EVI
      connect()
        .then(() => console.log("Session Started"))
        .catch((err) => {
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
             <Loader2 className="animate-spin" /> Connecting to EVI...
          </div>
        ) : isConnected ? (
          <div className="flex flex-col items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${isThinking ? "bg-purple-500 animate-bounce" : "bg-blue-500"}`} />
            <span className="text-sm font-medium text-gray-700">
               {isThinking ? "Speaking..." : "Ready"}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">Disconnected</span>
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
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Live Transcript</h3>
        <div className="h-64 overflow-y-auto space-y-4 pr-2 custom-scrollbar" id="transcript-container">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm italic mt-10">
              Start talking to see transcripts...
            </div>
          )}
          {messages.map((msg, idx) => {
            if (msg.type !== "user_message" && msg.type !== "assistant_message") return null;
            
            const isUser = msg.type === "user_message";
            return (
              <div 
                key={idx} 
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] text-gray-400 mb-1 px-1">
                  {isUser ? "You" : "Assistant"}
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
