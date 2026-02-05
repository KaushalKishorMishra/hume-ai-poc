import { Router } from "express";
import * as hume from "../services/humeConfig";

const router = Router();

// Helper for wrapping async calls
const wrap = (fn: Function) => async (req: any, res: any) => {
    try {
        const result = await fn(req, res);
        res.json(result);
    } catch (err: any) {
        res.status(err.code || 500).json(err);
    }
};

// --- Configs ---
router.get("/configs", wrap((req: any) => hume.listConfigs(req.query)));
router.post("/configs", wrap((req: any) => hume.createConfig(req.body)));
router.delete("/configs/:id", wrap((req: any) => hume.deleteConfig(req.params.id)));
router.patch("/configs/:id/name", wrap((req: any) => hume.updateConfigName(req.params.id, req.body.name)));

// Config Versions
router.get("/configs/:id", wrap((req: any) => hume.listConfigVersions(req.params.id, req.query)));
router.post("/configs/:id", wrap((req: any) => hume.createConfigVersion(req.params.id, req.body)));
router.get("/configs/:id/version/:version", wrap((req: any) => hume.getConfigVersion(req.params.id, parseInt(req.params.version))));
router.patch("/configs/:id/version/:version/description", wrap((req: any) => hume.updateConfigDescription(req.params.id, parseInt(req.params.version), req.body.description)));
router.delete("/configs/:id/version/:version", wrap((req: any) => hume.deleteConfigVersion(req.params.id, parseInt(req.params.version))));


// --- Prompts ---
router.get("/prompts", wrap((req: any) => hume.listPrompts(req.query)));
router.post("/prompts", wrap((req: any) => hume.createPrompt(req.body)));
router.delete("/prompts/:id", wrap((req: any) => hume.deletePrompt(req.params.id)));
router.patch("/prompts/:id/name", wrap((req: any) => hume.updatePromptName(req.params.id, req.body.name)));

// Prompt Versions
router.get("/prompts/:id", wrap((req: any) => hume.listPromptVersions(req.params.id, req.query)));
router.post("/prompts/:id", wrap((req: any) => hume.createPromptVersion(req.params.id, req.body)));
router.get("/prompts/:id/version/:version", wrap((req: any) => hume.getPromptVersion(req.params.id, parseInt(req.params.version))));
router.patch("/prompts/:id/version/:version/description", wrap((req: any) => hume.updatePromptDescription(req.params.id, parseInt(req.params.version), req.body.description)));
router.delete("/prompts/:id/version/:version", wrap((req: any) => hume.deletePromptVersion(req.params.id, parseInt(req.params.version))));


// --- Tools ---
router.get("/tools", wrap((req: any) => hume.listTools(req.query)));
router.post("/tools", wrap((req: any) => hume.createTool(req.body)));
router.delete("/tools/:id", wrap((req: any) => hume.deleteTool(req.params.id)));
router.patch("/tools/:id/name", wrap((req: any) => hume.updateToolName(req.params.id, req.body.name)));

// Tool Versions
router.get("/tools/:id", wrap((req: any) => hume.listToolVersions(req.params.id, req.query)));
router.post("/tools/:id", wrap((req: any) => hume.createToolVersion(req.params.id, req.body)));
router.get("/tools/:id/version/:version", wrap((req: any) => hume.getToolVersion(req.params.id, parseInt(req.params.version))));
router.patch("/tools/:id/version/:version/description", wrap((req: any) => hume.updateToolDescription(req.params.id, parseInt(req.params.version), req.body.description)));
router.delete("/tools/:id/version/:version", wrap((req: any) => hume.deleteToolVersion(req.params.id, parseInt(req.params.version))));


// --- Chats ---
router.get("/chats", wrap((req: any) => hume.listChatGroups(req.query)));

export default router;