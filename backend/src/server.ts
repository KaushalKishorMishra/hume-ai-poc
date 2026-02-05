import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHumeAccessToken } from "./services/humeAuth";
import * as humeConfigService from "./services/humeConfig";
import { getConfigId, setConfigId, saveInterview, resetDb } from "./db";
import humeRoutes from "./routes/hume";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Permissive CORS for POC
app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Hume Management Routes
app.use("/api/hume", humeRoutes);

const generatePrompt = () => {
	return `You are a strict Interviewer Bot. You have no reasoning capabilities outside of this script.
1. When you start (or are told to start), introduce yourself: 'Hi, this is an automated interview. Please say "Let's start" when you are ready.'
2. Wait for the user to say 'Let's start' or 'Ready' or 'Hello'.
3. Ask the questions provided in the following list one by one, waiting for an answer after each. 
If the list below is empty, start by asking: "Tell me about your background and experience."

Questions List:
{{ questions_list }}

4. After the last question is answered, say: 'Thank you. The interview is complete. Goodbye.'
5. Say exactly: "END_INTERVIEW_SESSION"`;
};

const INTERVIEW_PROMPT = generatePrompt();

/**
 * POST /api/session/setup
 */
app.post("/api/session/setup", async (req, res) => {
	try {
		let configId = await getConfigId();

		const INTERVIEW_CONFIG = {
			name: "Hume-POC-v4",
			evi_version: "3",
			prompt: { text: INTERVIEW_PROMPT },
			voice: { provider: "HUME_AI", name: "Ito" },
			tools: [], 
		};

		if (configId) {
			try {
				console.log(`🔍 Checking remote config: ${configId}`);
				const res = await humeConfigService.getConfig(configId);
				const latest = res?.configs_page?.[0] || (Array.isArray(res) ? res[0] : res);
                
                console.log("DEBUG: Latest config from Hume:", JSON.stringify(latest, null, 2));

				const promptMatches = latest?.prompt?.text === INTERVIEW_PROMPT;
                const nameMatches = latest?.name === INTERVIEW_CONFIG.name;

				if (!promptMatches || !nameMatches) {
					console.log("🔄 Configuration mismatch (prompt or name). Updating existing config...");
					await humeConfigService.updateConfig(configId!, INTERVIEW_CONFIG);
				} else {
					console.log("✅ Remote config is up-to-date.");
				}
			} catch (fetchErr) {
				console.log(
					"❌ Remote config not found or error fetching. Will re-verify by name.",
				);
				configId = null;
			}
		}

		if (!configId) {
			console.log("🔍 Checking for existing config by name on Hume...");
			const configsRes = await humeConfigService.listConfigs();
			const configs = Array.isArray(configsRes)
				? configsRes
				: configsRes?.configs_page || [];
			const found = configs.find((c: any) => c.name === INTERVIEW_CONFIG.name);

			if (found) {
				configId = found.id;
				console.log(
					`✅ Found existing config by name: ${configId}. Updating...`,
				);
				await humeConfigService.updateConfig(configId!, INTERVIEW_CONFIG);
			} else {
				console.log("📝 Creating new EVI Config...");
				const newConfig =
					await humeConfigService.createConfig(INTERVIEW_CONFIG);
				configId = newConfig.id;
			}
			await setConfigId(configId!);
		}

		const auth = await getHumeAccessToken();
		res.json({ accessToken: auth.accessToken, configId });
	} catch (err: any) {
		console.error("Session Setup Error:", err);
		res
			.status(err.code || 500)
			.json({ error: err.message, details: err.details });
	}
});

app.post("/api/session/record", async (req, res) => {
	try {
		const { chatGroupId, transcript } = req.body;
		await saveInterview(chatGroupId, transcript);
		res.json({ status: "saved" });
	} catch (err: any) {
		res.status(500).json({ error: "Failed to save interview" });
	}
});

app.post("/api/reset", async (req, res) => {
	try {
		await resetDb();
		res.json({ status: "reset_complete", message: "All database tables cleared." });
	} catch (err: any) {
		console.error("Reset Error:", err);
		res.status(500).json({ error: "Failed to reset database" });
	}
});

app.listen(PORT, () => {
	console.log(`✅ Secure Proxy running on http://localhost:${PORT}`);
});
