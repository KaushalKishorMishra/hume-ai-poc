import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHumeAccessToken } from "./services/humeAuth";
import configRoutes from "./routes/configRoutes";
import * as humeConfigService from "./services/humeConfig";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Permissive CORS for POC: allows all origins to avoid port mismatch errors
app.use(cors());

app.use(express.json());

// Health Check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Mount Config Routes
app.use("/api/configs", configRoutes);

/**
 * POST /api/session/setup
 * High-level endpoint: Creates a dynamic config and returns a token.
 * This satisfies the "create on server, share with frontend" architecture.
 */
app.post("/api/session/setup", async (req, res) => {
    try {
        // 1. Create a dynamic config on the fly
        // You can customize the prompt, voice, etc. here based on user needs
        const config = await humeConfigService.createConfig({
            name: `Session-${Date.now()}`,
            prompt: {
                text: "You are a helpful and empathetic AI assistant. Keep your responses concise and engaging."
            },
            voice: {
                provider: "HUME_AI",
                name: "ITO" // Example voice
            }
        });

        // 2. Get Access Token
        const auth = await getHumeAccessToken();
        if (auth.error) throw auth.error;

        // 3. Return both to frontend
        res.json({
            accessToken: auth.accessToken,
            configId: config.id
        });
    } catch (err: any) {
        res.status(err.code || 500).json({ error: err.message, details: err.details });
    }
});

/**
 * POST /api/auth/token
 * Returns a short-lived Access Token for the frontend.
 */
app.post("/api/auth/token", async (req, res) => {
	// 1. (Optional) Validate Client Request
	const clientAppId = req.headers["x-client-app-id"];
	if (
		process.env.REQUIRE_CLIENT_ID === "true" &&
		clientAppId !== process.env.CLIENT_APP_ID
	) {
		return res.status(403).json({ error: "Forbidden: Invalid Client Source" });
	}

	// 2. Fetch Token from Hume
	const result = await getHumeAccessToken();

	// 3. Handle Errors
	if (result.error) {
		return res.status(result.error.code).json(result.error);
	}

	// 4. Return Success
	return res.json({
		accessToken: result.accessToken,
		expiresIn: 3600, // Hume tokens last 60 minutes
	});
});

app.listen(PORT, () => {
	console.log(`✅ Secure Proxy running on http://localhost:${PORT}`);
});
