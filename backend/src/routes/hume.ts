import { Router, Request, Response } from "express";
import * as hume from "../services/humeConfig";
import { ApiError, PaginationParams } from "../types/hume";

const router = Router();

type AsyncHandler<T> = (req: Request, res: Response) => Promise<T>;

const wrap = <T>(fn: AsyncHandler<T>) => async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await fn(req, res);
    res.json(result);
  } catch (err) {
    const apiError = err as ApiError;
    res.status(apiError.code || 500).json(apiError);
  }
};

// --- Configs ---
router.get("/configs", wrap((req) => hume.listConfigs(req.query as PaginationParams)));
router.post("/configs", wrap((req) => hume.createConfig(req.body)));
router.delete("/configs/:id", wrap((req) => hume.deleteConfig(req.params.id)));
router.patch("/configs/:id/name", wrap((req) => hume.updateConfigName(req.params.id, req.body.name)));

// Config Versions
router.get("/configs/:id", wrap((req) => hume.listConfigVersions(req.params.id, req.query as PaginationParams)));
router.post("/configs/:id", wrap((req) => hume.createConfigVersion(req.params.id, req.body)));
router.get("/configs/:id/version/:version", wrap((req) => hume.getConfigVersion(req.params.id, parseInt(req.params.version))));
router.patch("/configs/:id/version/:version/description", wrap((req) => hume.updateConfigDescription(req.params.id, parseInt(req.params.version), req.body.description)));
router.delete("/configs/:id/version/:version", wrap((req) => hume.deleteConfigVersion(req.params.id, parseInt(req.params.version))));

// --- Prompts ---
router.get("/prompts", wrap((req) => hume.listPrompts(req.query as PaginationParams)));
router.post("/prompts", wrap((req) => hume.createPrompt(req.body)));
router.delete("/prompts/:id", wrap((req) => hume.deletePrompt(req.params.id)));
router.patch("/prompts/:id/name", wrap((req) => hume.updatePromptName(req.params.id, req.body.name)));

// Prompt Versions
router.get("/prompts/:id", wrap((req) => hume.listPromptVersions(req.params.id, req.query as PaginationParams)));
router.post("/prompts/:id", wrap((req) => hume.createPromptVersion(req.params.id, req.body)));
router.get("/prompts/:id/version/:version", wrap((req) => hume.getPromptVersion(req.params.id, parseInt(req.params.version))));
router.patch("/prompts/:id/version/:version/description", wrap((req) => hume.updatePromptDescription(req.params.id, parseInt(req.params.version), req.body.description)));
router.delete("/prompts/:id/version/:version", wrap((req) => hume.deletePromptVersion(req.params.id, parseInt(req.params.version))));

// --- Tools ---
router.get("/tools", wrap((req) => hume.listTools(req.query as PaginationParams)));
router.post("/tools", wrap((req) => hume.createTool(req.body)));
router.delete("/tools/:id", wrap((req) => hume.deleteTool(req.params.id)));
router.patch("/tools/:id/name", wrap((req) => hume.updateToolName(req.params.id, req.body.name)));

// Tool Versions
router.get("/tools/:id", wrap((req) => hume.listToolVersions(req.params.id, req.query as PaginationParams)));
router.post("/tools/:id", wrap((req) => hume.createToolVersion(req.params.id, req.body)));
router.get("/tools/:id/version/:version", wrap((req) => hume.getToolVersion(req.params.id, parseInt(req.params.version))));
router.patch("/tools/:id/version/:version/description", wrap((req) => hume.updateToolDescription(req.params.id, parseInt(req.params.version), req.body.description)));
router.delete("/tools/:id/version/:version", wrap((req) => hume.deleteToolVersion(req.params.id, parseInt(req.params.version))));

// --- Chats ---
router.get("/chats", wrap((req) => hume.listChatGroups(req.query as PaginationParams)));

export default router;
