import { useEffect, useState } from "react";
import { VoiceProvider } from "@humeai/voice-react";
import { VoiceChat } from "./components/VoiceChat";
import { ArchitectureView } from "./components/ArchitectureView";
import { setupSession } from "./api/session";
import { AppError } from "./utils/errorMapper";
import { AlertCircle, RefreshCcw, Layout } from "lucide-react";

export default function App() {
	const [token, setToken] = useState<string | null>(null);
	const [configId, setConfigId] = useState<string | null>(null);
	const [appError, setAppError] = useState<AppError | null>(null);
	const [view, setView] = useState<"chat" | "arch">("chat");

	// 1. Unified Session Setup (Server-side Config Creation)
	const init = async () => {
		setAppError(null);
		try {
			const { accessToken, configId: serverConfigId } = await setupSession();
			setToken(accessToken);
			setConfigId(serverConfigId);
		} catch (err: any) {
			console.error("Init Error:", err);
			setAppError({
				type: "Auth",
				message: err.message || "Failed to initialize session.",
				action: "Retry",
			});
		}
	};

	useEffect(() => {
		init();
	}, []);

	// 2. Global Error Handler
	const handleError = (error: AppError) => {
		setAppError(error);
		// If it's a fatal auth error, clear token to force re-login flow if needed
		if (error.type === "Auth") setToken(null);
	};

	// 3. Render Error State
	if (appError) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
				<div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
					<div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
						<AlertCircle />
					</div>
					<h2 className="text-lg font-bold text-gray-900 mb-2">
						{appError.type} Error
					</h2>
					<p className="text-gray-600 mb-6">{appError.message}</p>

					<button
						onClick={() => {
							if (appError.action === "Refresh") window.location.reload();
							else init();
						}}
						className="w-full py-2 bg-black text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2"
					>
						<RefreshCcw size={16} />
						{appError.action === "Refresh" ? "Reload Page" : "Try Again"}
					</button>
				</div>
			</div>
		);
	}

	// 4. Loading State
	if (!token || !configId) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				Loading secure session...
			</div>
		);
	}

	// 5. Main UI
	return (
		<VoiceProvider
			messageHistoryLimit={20}
			// Debug mode logs socket messages
			onMessage={(msg) => console.log(">>", msg)}
		>
			<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-10">
				<div className="container mx-auto">
					<header className="mb-10 flex flex-col items-center relative">
						<h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
							Hume EVI POC
						</h1>
						<p className="text-center text-gray-500">
							Secure Speech-to-Speech Demo
						</p>

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
								accessToken={token}
								configId={configId}
							/>
						) : (
							<ArchitectureView onBack={() => setView("chat")} />
						)}
					</main>
				</div>
			</div>
		</VoiceProvider>
	);
}
