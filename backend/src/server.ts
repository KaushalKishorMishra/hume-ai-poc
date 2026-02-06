import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHumeAccessToken } from "./services/humeAuth";
import * as humeConfigService from "./services/humeConfig";
import { getConfigId, setConfigId, saveInterview, resetDb, InterviewRecord } from "./db";
import { sessionManager } from "./services/sessionManager";
import humeRoutes from "./routes/hume";
import { HumeConfig, HumeTool, ApiError } from "./types/hume";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

app.use("/api/hume", humeRoutes);

const generatePrompt = (): string => {
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

interface InterviewConfig {
  name: string;
  evi_version: string;
  prompt: { text: string };
  voice: { provider: string; name: string };
  tools: HumeTool[];
}

interface SessionSetupResponse {
  accessToken: string;
  configId: string;
}

interface RecordRequestBody {
  chatGroupId: string;
  transcript: unknown[];
  status?: 'COMPLETED' | 'ERROR';
  disconnectReason?: string;
  totalQuestions?: number;
  durationMs?: number;
  errorReason?: string;
}

interface SessionEndBody {
  sessionId: string;
}

interface SessionStartBody {
  sessionId: string;
  totalQuestions: number;
}

interface HeartbeatBody {
  sessionId: string;
}

app.post("/api/session/setup", async (_req: Request, res: Response): Promise<void> => {
  try {
    let configId = await getConfigId();

    const INTERVIEW_CONFIG: InterviewConfig = {
      name: "Hume-POC-v4",
      evi_version: "3",
      prompt: { text: INTERVIEW_PROMPT },
      voice: { provider: "HUME_AI", name: "Ito" },
      tools: [],
    };

    if (configId) {
      try {
        console.log(`🔍 Checking remote config: ${configId}`);
        const configResponse = await humeConfigService.getConfig(configId);
        const configs = configResponse?.configs_page || [];
        const latest = configs[0] as HumeConfig | undefined;

        console.log("DEBUG: Latest config from Hume:", JSON.stringify(latest, null, 2));

        const promptMatches = latest?.prompt?.text === INTERVIEW_PROMPT;
        const nameMatches = latest?.name === INTERVIEW_CONFIG.name;

        if (!promptMatches || !nameMatches) {
          console.log("🔄 Configuration mismatch (prompt or name). Updating existing config...");
          await humeConfigService.updateConfig(configId, INTERVIEW_CONFIG);
        } else {
          console.log("✅ Remote config is up-to-date.");
        }
      } catch (fetchErr) {
        console.log("❌ Remote config not found or error fetching. Will re-verify by name.");
        configId = null;
      }
    }

    if (!configId) {
      console.log("🔍 Checking for existing config by name on Hume...");
      const configsRes = await humeConfigService.listConfigs();
      const configs = configsRes?.configs_page || [];
      const found = configs.find((c) => c.name === INTERVIEW_CONFIG.name);

      if (found && found.id) {
        configId = found.id;
        console.log(`✅ Found existing config by name: ${configId}. Updating...`);
        await humeConfigService.updateConfig(configId, INTERVIEW_CONFIG);
      } else {
        console.log("📝 Creating new EVI Config...");
        const newConfig = await humeConfigService.createConfig(INTERVIEW_CONFIG);
        if (!newConfig.id) {
          throw { code: 500, message: "Failed to create config - no ID returned" } as ApiError;
        }
        configId = newConfig.id;
      }
      await setConfigId(configId);
    }

    const auth = await getHumeAccessToken();
    
    if (auth.error) {
      res.status(auth.error.code).json({ error: auth.error.message, details: auth.error.details });
      return;
    }

    const response: SessionSetupResponse = { accessToken: auth.accessToken!, configId };
    res.json(response);
  } catch (err) {
    console.error("Session Setup Error:", err);
    const apiError = err as ApiError;
    res.status(apiError.code || 500).json({ error: apiError.message, details: apiError.details });
  }
});

// Check session capacity before starting
app.get("/api/session/capacity", (_req: Request, res: Response): void => {
  const capacity = sessionManager.getCapacity();
  res.json(capacity);
});

// Start a new session (reserves a slot)
app.post("/api/session/start", (req: Request<object, object, SessionStartBody>, res: Response): void => {
  const { sessionId, totalQuestions } = req.body;
  
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  
  const success = sessionManager.startSession(sessionId, totalQuestions || 0);
  
  if (!success) {
    const capacity = sessionManager.getCapacity();
    res.status(429).json({
      error: "Concurrent session limit reached",
      ...capacity,
    });
    return;
  }
  
  res.json({ status: "started", sessionId });
});

// End a session (releases the slot)
app.post("/api/session/end", (req: Request<object, object, SessionEndBody>, res: Response): void => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  
  const session = sessionManager.endSession(sessionId);
  res.json({ status: "ended", session });
});

// Heartbeat to keep session alive
app.post("/api/session/heartbeat", (req: Request<object, object, HeartbeatBody>, res: Response): void => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  
  sessionManager.heartbeat(sessionId);
  res.json({ status: "ok" });
});

// Get active sessions (admin/debug endpoint)
app.get("/api/session/active", (_req: Request, res: Response): void => {
  const sessions = sessionManager.getActiveSessions();
  const capacity = sessionManager.getCapacity();
  res.json({ sessions, ...capacity });
});

// Record interview with enhanced data
app.post("/api/session/record", async (req: Request<object, object, RecordRequestBody>, res: Response): Promise<void> => {
  try {
    const {
      chatGroupId,
      transcript,
      status = 'COMPLETED',
      disconnectReason = 'completed',
      totalQuestions = 0,
      durationMs = 0,
      errorReason,
    } = req.body;
    
    // End the session if it exists
    sessionManager.endSession(chatGroupId);
    
    const record: InterviewRecord = {
      chatGroupId,
      transcript: Array.isArray(transcript) ? transcript : [],
      status: status as 'COMPLETED' | 'ERROR',
      disconnectReason,
      totalQuestions,
      durationMs,
      errorReason,
    };
    
    await saveInterview(record);
    res.json({ status: "saved" });
  } catch (err) {
    console.error("Record Error:", err);
    res.status(500).json({ error: "Failed to save interview" });
  }
});

app.post("/api/reset", async (_req: Request, res: Response): Promise<void> => {
  try {
    await resetDb();
    res.json({ status: "reset_complete", message: "All database tables cleared." });
  } catch (err) {
    console.error("Reset Error:", err);
    res.status(500).json({ error: "Failed to reset database" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Secure Proxy running on http://localhost:${PORT}`);
});
