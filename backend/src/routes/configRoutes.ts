import { Router } from "express";
import * as humeConfigService from "../services/humeConfig";

const router = Router();

// Create a new EVI Config
router.post("/", async (req, res) => {
  try {
    const config = await humeConfigService.createConfig(req.body);
    res.status(201).json(config);
  } catch (err: any) {
    res.status(err.code || 500).json({ error: err.message, details: err.details });
  }
});

// List EVI Configs
router.get("/", async (req, res) => {
  try {
    const configs = await humeConfigService.listConfigs(req.query);
    res.json(configs);
  } catch (err: any) {
    res.status(err.code || 500).json({ error: err.message, details: err.details });
  }
});

// Get a specific EVI Config
router.get("/:id", async (req, res) => {
  try {
    const config = await humeConfigService.getConfig(req.params.id);
    res.json(config);
  } catch (err: any) {
    res.status(err.code || 500).json({ error: err.message, details: err.details });
  }
});

// Update an EVI Config
router.patch("/:id", async (req, res) => {
  try {
    const config = await humeConfigService.updateConfig(req.params.id, req.body);
    res.json(config);
  } catch (err: any) {
    res.status(err.code || 500).json({ error: err.message, details: err.details });
  }
});

// Delete an EVI Config
router.delete("/:id", async (req, res) => {
  try {
    await humeConfigService.deleteConfig(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.code || 500).json({ error: err.message, details: err.details });
  }
});

export default router;
