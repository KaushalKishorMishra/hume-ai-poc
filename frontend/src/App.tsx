import { useEffect } from "react";
import { VoiceProvider } from "@humeai/voice-react";
import { VoiceChat } from "./components/VoiceChat";
import { ArchitectureView } from "./components/ArchitectureView";
import { setupSession } from "./api/session";
import { AlertCircle, RefreshCcw, Layout, Loader2, Users, Clock } from "lucide-react";
import { useInterviewState } from "./hooks/useInterviewState";
import { ErrorReason, InterviewStage } from "./types/interview";
import { MappedError, getErrorReasonMessage } from "./utils/errorMapper";
import { useState } from "react";

type ViewType = "chat" | "arch";

export default function App() {
  const [view, setView] = useState<ViewType>("chat");
  const interview = useInterviewState();
  const { state, actions, computed } = interview;

  const init = async () => {
    actions.startInitializing();
    try {
      const { accessToken, configId } = await setupSession();
      actions.initializationSuccess(accessToken, configId);
    } catch (err) {
      console.error("Init Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize session.";
      
      // Determine error reason
      let reason = ErrorReason.SERVER_ERROR;
      if (errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("401")) {
        reason = ErrorReason.AUTH_ERROR;
      } else if (errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch")) {
        reason = ErrorReason.NETWORK_ERROR;
      }
      
      actions.initializationFailed(reason, errorMessage);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = (error: MappedError) => {
    actions.disconnect('error', error.reason, error.message);
  };

  // Loading screen during initialization
  if (state.loading.isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Setting up your session</h2>
          <p className="text-gray-500 text-sm">Connecting to the interview server...</p>
          
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Authenticating</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
              <span>Loading configuration</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error screen
  if (state.error.hasError && state.stage === InterviewStage.ERROR && !state.accessToken) {
    const { reason, message, recoverable } = state.error;
    const reasonText = reason ? getErrorReasonMessage(reason) : "Unknown error";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Start</h2>
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-sm text-gray-400 mb-6">{reasonText}</p>



            {/* Specific error guidance */}
            {reason === ErrorReason.CONCURRENT_LIMIT_EXCEEDED && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-yellow-700">
                  <Users size={16} />
                  <span className="text-sm">Too many active interviews. Please wait a moment.</span>
                </div>
              </div>
            )}

            {reason === ErrorReason.NETWORK_ERROR && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-blue-700">
                  <Clock size={16} />
                  <span className="text-sm">Check your internet connection and try again.</span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (recoverable) {
                  init();
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-3 bg-black text-white rounded-xl hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCcw size={18} />
              {recoverable ? "Try Again" : "Reload Page"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Still waiting for tokens
  if (!state.accessToken || !state.configId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800">Loading session...</h2>
        </div>
      </div>
    );
  }

  return (
    <VoiceProvider messageHistoryLimit={50} onMessage={(msg) => console.log(">>", msg)}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-10">
        <div className="container mx-auto">
          <header className="mb-10 flex flex-col items-center relative">
            <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
              Hume EVI POC
            </h1>
            <p className="text-center text-gray-500">Secure Speech-to-Speech Demo</p>

            {/* Stage Badge */}
            {state.stage !== InterviewStage.IDLE && (
              <div className="mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  state.stage === InterviewStage.COMPLETED
                    ? 'bg-green-100 text-green-700'
                    : state.stage === InterviewStage.IN_PROGRESS
                      ? 'bg-blue-100 text-blue-700'
                      : state.stage === InterviewStage.ERROR
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                }`}>
                  {state.stage.replace('_', ' ')}
                </span>
              </div>
            )}

            {view === "chat" && (
              <button
                onClick={() => setView("arch")}
                className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Layout size={16} />
                View Architecture
              </button>
            )}
          </header>

          <main>
            {view === "chat" ? (
              <VoiceChat
                onError={handleError}
                accessToken={state.accessToken}
                configId={state.configId}
                interview={interview}
              />
            ) : (
              <ArchitectureView onBack={() => setView("chat")} />
            )}
          </main>

          {/* Debug info - can be removed in production */}
          {import.meta.env.DEV && computed.duration !== null && (
            <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg">
              <div>Duration: {Math.round(computed.duration / 1000)}s</div>
              <div>Stage: {state.stage}</div>
            </div>
          )}
        </div>
      </div>
    </VoiceProvider>
  );
}
