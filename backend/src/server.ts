import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHumeAccessToken } from "./services/humeAuth";
import configRoutes from "./routes/configRoutes";
import * as humeConfigService from "./services/humeConfig";
import { getConfigId, setConfigId } from "./db";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Permissive CORS for POC
app.use(cors());
app.use(express.json());

// Health Check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Mount Config Routes
app.use("/api/configs", configRoutes);

/**
 * POST /api/session/setup
 * Orchestrator: Gets or Creates a Hume EVI config and returns a session token.
 * Uses SQLite for robust persistence.
 */
app.post("/api/session/setup", async (req, res) => {
    try {
        let configId = await getConfigId();

        if (configId) {
            console.log(`♻️  Reusing stored config ID from database: ${configId}`);
        }

        // 1. If no local ID, check the Hume account for existing configs
        if (!configId) {
            console.log("🔍 No local config found in DB. Fetching from Hume...");
            const existingConfigs = await humeConfigService.listConfigs();
            const configsList = Array.isArray(existingConfigs) ? existingConfigs : existingConfigs?.configs;

            if (configsList && configsList.length > 0) {
                configId = configsList[0].id;
                console.log(`✅ Found existing config on account: ${configId}`);
            }
        }

        // 2. If still no config, create a new one using VERIFIED version "3"
        if (!configId) {
            console.log("📝 Creating new EVI Config...");
            try {
                const newConfig = await humeConfigService.createConfig({
                    name: `Hume-POC-Session-${Date.now()}`,
                    evi_version: "3", // Verified via inspection script
                    prompt: {
                        text: "You are a helpful and empathetic AI assistant. Keep your responses concise and engaging."
                    },
                    voice: {
                        provider: "HUME_AI",
                        name: "Ito"
                    }
                });
                configId = newConfig.id;
                console.log(`✅ Created new config: ${configId}`);
            } catch (creationErr: any) {
                // If creation fails, we must return the error to debug further
                console.error("❌ Failed to create config:", creationErr);
                throw creationErr;
            }
        }

        // 3. Save for future use
        if (configId) {
            await setConfigId(configId);
        }

        // 4. Generate Auth Token
        const auth = await getHumeAccessToken();
        if (auth.error) throw auth.error;

        res.json({
            accessToken: auth.accessToken,
            configId: configId
        });

    } catch (err: any) {
        console.error("Session Setup Error:", err);
        const statusCode = err.code || 500;
        const message = err.message || "Internal Server Error";
        res.status(statusCode).json({ 
            error: message, 
            details: err.details || err.response?.data 
        });
    }
});

/**
 * POST /api/auth/token
 * Legacy token-only endpoint
 */
app.post("/api/auth/token", async (req, res) => {
	const clientAppId = req.headers["x-client-app-id"];
	if (process.env.REQUIRE_CLIENT_ID === "true" && clientAppId !== process.env.CLIENT_APP_ID) {
		return res.status(403).json({ error: "Forbidden: Invalid Client Source" });
	}

	const result = await getHumeAccessToken();
	if (result.error) return res.status(result.error.code).json(result.error);

	return res.json({
		accessToken: result.accessToken,
		expiresIn: 3600
	});
});

app.listen(PORT, () => {
	console.log(`✅ Secure Proxy running on http://localhost:${PORT}`);
});