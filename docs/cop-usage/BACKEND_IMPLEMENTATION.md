# Hume AI - Backend Implementation Guide

## Overview
This document provides a comprehensive guide for backend developers implementing Hume AI integration using Node.js/Express and TypeScript.

## Table of Contents
1. [Setup & Installation](#setup--installation)
2. [Project Structure](#project-structure)
3. [Core Services](#core-services)
4. [API Routes](#api-routes)
5. [Database Setup](#database-setup)
6. [Authentication & Middleware](#authentication--middleware)
7. [Error Handling](#error-handling)
8. [Performance & Optimization](#performance--optimization)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Setup & Installation

### Prerequisites
- Node.js 16+
- TypeScript 4.5+
- PostgreSQL or MongoDB
- npm or yarn

### Installation

```bash
# Initialize project
npm init -y

# Install dependencies
npm install express dotenv cors helmet uuid
npm install hume axios
npm install pg # or mongoose for MongoDB

# Dev dependencies
npm install -D typescript @types/express @types/node ts-node nodemon
npm install -D eslint prettier jest @types/jest ts-jest

# Initialize TypeScript
npx tsc --init
```

### Directory Structure

```
project/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   ├── env.ts           # Environment variables
│   │   ├── database.ts       # Database connection
│   │   └── hume.ts           # Hume client setup
│   ├── services/
│   │   ├── chatService.ts
│   │   ├── expressionService.ts
│   │   └── configService.ts
│   ├── routes/
│   │   ├── chat.routes.ts
│   │   ├── expression.routes.ts
│   │   └── config.routes.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── logger.ts
│   ├── models/
│   │   ├── Chat.ts
│   │   ├── Message.ts
│   │   └── Job.ts
│   └── utils/
│       ├── logger.ts
│       └── helpers.ts
├── tests/
│   ├── services.test.ts
│   └── routes.test.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Environment Configuration

```bash
# .env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/hume_ai
HUME_API_KEY=your_api_key_here
JWT_SECRET=your_jwt_secret
LOG_LEVEL=info
```

---

## Project Structure

### Configuration Files

#### src/config/env.ts
```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  HUME_API_KEY: string;
  JWT_SECRET: string;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

const getConfig = (): EnvConfig => {
  return {
    NODE_ENV: (process.env.NODE_ENV || 'development') as any,
    PORT: parseInt(process.env.PORT || '3001', 10),
    DATABASE_URL: process.env.DATABASE_URL || '',
    HUME_API_KEY: process.env.HUME_API_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
    LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as any,
  };
};

export default getConfig();
```

#### src/config/hume.ts
```typescript
import Hume from 'hume';
import config from './env';

let humeClient: Hume;

export const initializeHumeClient = (): Hume => {
  if (!humeClient) {
    humeClient = new Hume({
      apiKey: config.HUME_API_KEY,
    });
  }
  return humeClient;
};

export const getHumeClient = (): Hume => {
  if (!humeClient) {
    throw new Error('Hume client not initialized');
  }
  return humeClient;
};

export default { initializeHumeClient, getHumeClient };
```

#### src/config/database.ts
```typescript
import { Pool, QueryResult } from 'pg';
import config from './env';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

pool.on('connect', () => {
  logger.info('Database connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Executed query in ${duration}ms`);
    return result;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

export const getPool = () => pool;

export default { query, getPool };
```

---

## Core Services

### 1. Chat Service

```typescript
// src/services/chatService.ts
import { v4 as uuidv4 } from 'uuid';
import Hume from 'hume';
import { query } from '../config/database';
import logger from '../utils/logger';

export interface CreateChatParams {
  configId: string;
  userId: string;
}

export interface SendMessageParams {
  chatId: string;
  message: string;
  audioEnabled: boolean;
}

export class ChatService {
  private humeClient: Hume;

  constructor(humeClient: Hume) {
    this.humeClient = humeClient;
  }

  async createChat({ configId, userId }: CreateChatParams) {
    try {
      logger.info(`Creating chat for user ${userId}`);

      // Create chat with Hume API
      const chat = await this.humeClient.empathicVoice.chat.create({
        configId,
      });

      // Store in database
      const result = await query(
        `INSERT INTO chats (chat_id, user_id, config_id, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [chat.id, userId, configId, 'active']
      );

      logger.info(`Chat created: ${chat.id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create chat:', error);
      throw new Error('Failed to create chat');
    }
  }

  async sendMessage({
    chatId,
    message,
    audioEnabled,
  }: SendMessageParams) {
    try {
      logger.info(`Sending message to chat ${chatId}`);

      // Send message via Hume API
      const response = await this.humeClient.empathicVoice.chat.sendMessage({
        chatId,
        message,
      });

      // Generate audio if enabled
      let audioUrl = null;
      if (audioEnabled && response.message) {
        audioUrl = await this.generateAudio(response.message);
      }

      // Store interaction in database
      await query(
        `INSERT INTO interactions (chat_id, user_message, assistant_message, audio_url, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chatId, message, response.message, audioUrl]
      );

      logger.info(`Message sent to chat ${chatId}`);

      return {
        message: response.message,
        audioUrl,
        metadata: response.metadata || {},
      };
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw new Error('Failed to send message');
    }
  }

  async generateAudio(text: string): Promise<string> {
    // Implement text-to-speech conversion
    // Example using a TTS service (Google Cloud, AWS Polly, etc.)
    try {
      // This is a placeholder - implement your TTS service
      const audioUrl = `data:audio/wav;base64,${Buffer.from(text).toString('base64')}`;
      return audioUrl;
    } catch (error) {
      logger.error('Failed to generate audio:', error);
      throw error;
    }
  }

  async endChat(chatId: string) {
    try {
      logger.info(`Ending chat ${chatId}`);

      // End chat with Hume API
      await this.humeClient.empathicVoice.chat.delete({ chatId });

      // Update database
      await query(
        `UPDATE chats SET status = $1, closed_at = NOW() WHERE chat_id = $2`,
        ['closed', chatId]
      );

      logger.info(`Chat ended: ${chatId}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to end chat:', error);
      throw new Error('Failed to end chat');
    }
  }

  async getChatHistory(chatId: string) {
    try {
      const result = await query(
        `SELECT * FROM interactions WHERE chat_id = $1 ORDER BY created_at ASC`,
        [chatId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch chat history:', error);
      throw new Error('Failed to fetch chat history');
    }
  }

  async getUserChats(userId: string) {
    try {
      const result = await query(
        `SELECT * FROM chats WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch user chats:', error);
      throw new Error('Failed to fetch user chats');
    }
  }
}

export default ChatService;
```

### 2. Expression Service

```typescript
// src/services/expressionService.ts
import fs from 'fs';
import path from 'path';
import Hume from 'hume';
import { query } from '../config/database';
import logger from '../utils/logger';

export interface AnalyzeVideoParams {
  filePath: string;
  userId: string;
  fileName: string;
}

export class ExpressionService {
  private humeClient: Hume;
  private pollAttempts = 60;
  private pollIntervalMs = 5000;

  constructor(humeClient: Hume) {
    this.humeClient = humeClient;
  }

  async analyzeVideo({
    filePath,
    userId,
    fileName,
  }: AnalyzeVideoParams) {
    try {
      logger.info(`Starting video analysis for file: ${fileName}`);

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      // Start batch inference job
      const job = await this.humeClient.expressionMeasurement.batch
        .startInferenceJobFromLocalFile({
          file: [fs.createReadStream(filePath)],
        });

      // Store job info in database
      const result = await query(
        `INSERT INTO jobs (job_id, user_id, file_name, file_path, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [job.id, userId, fileName, filePath, 'processing']
      );

      logger.info(`Video analysis started: ${job.id}`);

      return {
        jobId: job.id,
        status: 'processing',
        message: 'Video analysis started',
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to start video analysis:', error);
      throw new Error('Failed to start video analysis');
    }
  }

  async getAnalysisResults(jobId: string) {
    try {
      const results = await this.humeClient.expressionMeasurement.batch
        .getInferenceJobStatus({
          jobId,
        });

      // Update database with results
      if (results.status === 'completed') {
        await query(
          `UPDATE jobs SET status = $1, results = $2, completed_at = NOW() WHERE job_id = $3`,
          ['completed', JSON.stringify(results.data), jobId]
        );
      }

      return {
        jobId,
        status: results.status,
        data: results.data,
        predictions: this.parsePredictions(results.data),
      };
    } catch (error) {
      logger.error('Failed to get analysis results:', error);
      throw new Error('Failed to get analysis results');
    }
  }

  private parsePredictions(data: any) {
    // Parse expression data and extract key metrics
    const predictions = {
      emotions: {} as Record<string, number[]>,
      confidence: [] as number[],
      timestamps: [] as Array<{
        time: number;
        emotions: Record<string, number>;
      }>,
    };

    if (data?.predictions) {
      data.predictions.forEach((prediction: any, index: number) => {
        predictions.timestamps.push({
          time: prediction.time || index,
          emotions: prediction.emotions || {},
        });

        // Aggregate emotions
        Object.entries(prediction.emotions || {}).forEach(([emotion, value]: any) => {
          if (!predictions.emotions[emotion]) {
            predictions.emotions[emotion] = [];
          }
          predictions.emotions[emotion].push(value);
        });

        if (prediction.confidence) {
          predictions.confidence.push(prediction.confidence);
        }
      });
    }

    return predictions;
  }

  async pollForResults(jobId: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.pollAttempts; attempt++) {
      try {
        const results = await this.getAnalysisResults(jobId);

        if (results.status === 'completed') {
          logger.info(`Analysis completed: ${jobId}`);
          return results;
        }

        if (results.status === 'failed') {
          throw new Error('Analysis job failed');
        }

        // Wait before next attempt
        await new Promise(resolve => 
          setTimeout(resolve, this.pollIntervalMs)
        );
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Polling attempt ${attempt + 1} failed:`, error);
      }
    }

    throw new Error(
      lastError?.message || 
      `Analysis job timeout after ${this.pollAttempts} attempts`
    );
  }

  async getJobStatus(jobId: string) {
    try {
      const result = await query(
        `SELECT * FROM jobs WHERE job_id = $1`,
        [jobId]
      );

      if (result.rows.length === 0) {
        throw new Error('Job not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get job status:', error);
      throw new Error('Failed to get job status');
    }
  }

  async getUserJobs(userId: string) {
    try {
      const result = await query(
        `SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch user jobs:', error);
      throw new Error('Failed to fetch user jobs');
    }
  }

  async deleteJob(jobId: string) {
    try {
      const result = await query(
        `SELECT file_path FROM jobs WHERE job_id = $1`,
        [jobId]
      );

      if (result.rows.length > 0 && result.rows[0].file_path) {
        fs.unlinkSync(result.rows[0].file_path);
      }

      await query(
        `DELETE FROM jobs WHERE job_id = $1`,
        [jobId]
      );

      logger.info(`Job deleted: ${jobId}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete job:', error);
      throw new Error('Failed to delete job');
    }
  }
}

export default ExpressionService;
```

### 3. Config Service

```typescript
// src/services/configService.ts
import Hume from 'hume';
import { query } from '../config/database';
import logger from '../utils/logger';

export class ConfigService {
  private humeClient: Hume;

  constructor(humeClient: Hume) {
    this.humeClient = humeClient;
  }

  async listConfigs() {
    try {
      const configs = await this.humeClient.empathicVoice.configs.listConfigs();
      return configs;
    } catch (error) {
      logger.error('Failed to list configs:', error);
      throw new Error('Failed to list configs');
    }
  }

  async createConfig(name: string, version: any) {
    try {
      const config = await this.humeClient.empathicVoice.configs.createConfig({
        name,
        version,
      });

      // Store in database for quick access
      await query(
        `INSERT INTO configs (config_name, config_data, created_at)
         VALUES ($1, $2, NOW())`,
        [name, JSON.stringify(config)]
      );

      logger.info(`Config created: ${name}`);
      return config;
    } catch (error) {
      logger.error('Failed to create config:', error);
      throw new Error('Failed to create config');
    }
  }

  async getConfigVersions(configId: string) {
    try {
      const versions = await this.humeClient.empathicVoice.configs
        .listConfigVersions(configId);
      return versions;
    } catch (error) {
      logger.error('Failed to get config versions:', error);
      throw new Error('Failed to get config versions');
    }
  }

  async getCachedConfigs() {
    try {
      const result = await query(
        `SELECT * FROM configs ORDER BY created_at DESC LIMIT 20`
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to get cached configs:', error);
      throw new Error('Failed to get cached configs');
    }
  }
}

export default ConfigService;
```

---

## API Routes

### 1. Chat Routes

```typescript
// src/routes/chat.routes.ts
import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import ChatService from '../services/chatService';
import { getHumeClient } from '../config/hume';
import logger from '../utils/logger';

const router: Router = express.Router();
const chatService = new ChatService(getHumeClient());

// Initialize chat session
router.post('/initialize', authenticate, async (req, res, next) => {
  try {
    const { configId } = req.body;
    const userId = req.user?.id;

    if (!configId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const chat = await chatService.createChat({ configId, userId });
    res.status(201).json({
      chatId: chat.chat_id,
      status: 'initialized',
      createdAt: chat.created_at,
    });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/send-message', authenticate, async (req, res, next) => {
  try {
    const { chatId, message, audioEnabled } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await chatService.sendMessage({
      chatId,
      message,
      audioEnabled: audioEnabled ?? true,
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get chat history
router.get('/history/:chatId', authenticate, async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const history = await chatService.getChatHistory(chatId);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

// Get user chats
router.get('/my-chats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const chats = await chatService.getUserChats(userId);
    res.json({ chats });
  } catch (error) {
    next(error);
  }
});

// End chat
router.post('/end', authenticate, async (req, res, next) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'Missing chatId' });
    }

    const result = await chatService.endChat(chatId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 2. Expression Routes

```typescript
// src/routes/expression.routes.ts
import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth';
import ExpressionService from '../services/expressionService';
import { getHumeClient } from '../config/hume';
import logger from '../utils/logger';

const router: Router = express.Router();
const expressionService = new ExpressionService(getHumeClient());

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Upload and analyze video
router.post(
  '/analyze',
  authenticate,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const file = req.file;

      if (!file || !userId) {
        return res.status(400).json({ error: 'Missing file or user' });
      }

      const result = await expressionService.analyzeVideo({
        filePath: file.path,
        userId,
        fileName: file.originalname,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get analysis results
router.get('/results/:jobId', authenticate, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const results = await expressionService.getAnalysisResults(jobId);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get job status
router.get('/job-status/:jobId', authenticate, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const status = await expressionService.getJobStatus(jobId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Poll for results (async)
router.post('/poll-results/:jobId', authenticate, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const results = await expressionService.pollForResults(jobId);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get user jobs
router.get('/my-jobs', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobs = await expressionService.getUserJobs(userId);
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

// Delete job
router.delete('/:jobId', authenticate, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const result = await expressionService.deleteJob(jobId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## Database Setup

### PostgreSQL Schema

```sql
-- Create chats table
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  chat_id UUID UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  config_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create interactions table
CREATE TABLE interactions (
  id SERIAL PRIMARY KEY,
  chat_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

-- Create jobs table
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_id UUID UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(255),
  file_path TEXT,
  status VARCHAR(50) DEFAULT 'processing',
  results JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create configs table
CREATE TABLE configs (
  id SERIAL PRIMARY KEY,
  config_name VARCHAR(255),
  config_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_interactions_chat_id ON interactions(chat_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
```

---

## Authentication & Middleware

### 1. Authentication Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 2. Error Handler Middleware

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface CustomError extends Error {
  status?: number;
  code?: string;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  logger.error(`[${status}] ${message}`, error);

  res.status(status).json({
    error: message,
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};
```

### 3. Logger Middleware

```typescript
// src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};
```

---

## Error Handling

### Custom Error Classes

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class HumeAPIError extends AppError {
  constructor(message: string, originalError?: any) {
    super(`Hume API Error: ${message}`, 502, 'HUME_API_ERROR');
  }
}
```

---

## Performance & Optimization

### 1. Caching Strategy

```typescript
// src/utils/cache.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

export const cacheGet = (key: string) => {
  return cache.get(key);
};

export const cacheSet = (key: string, value: any, ttl?: number) => {
  cache.set(key, value, ttl);
};

export const cacheDel = (key: string) => {
  cache.del(key);
};

export const cacheFlush = () => {
  cache.flushAll();
};

export default { cacheGet, cacheSet, cacheDel, cacheFlush };
```

### 2. Rate Limiting

```typescript
// src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

export const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Too many video uploads',
});
```

### 3. Database Connection Pooling

```typescript
// Already configured in src/config/database.ts
// Pool is automatically created with default connection pooling
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20, // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## Testing

### Service Tests

```typescript
// src/__tests__/chatService.test.ts
import ChatService from '../services/chatService';
import * as database from '../config/database';
import Hume from 'hume';

jest.mock('../config/database');
jest.mock('hume');

describe('ChatService', () => {
  let chatService: ChatService;
  let mockHumeClient: jest.Mocked<Hume>;

  beforeEach(() => {
    mockHumeClient = new Hume({ apiKey: 'test' }) as jest.Mocked<Hume>;
    chatService = new ChatService(mockHumeClient);
  });

  describe('createChat', () => {
    it('should create a chat successfully', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [{ chat_id: 'test-id', user_id: 'user-1' }],
      });

      const result = await chatService.createChat({
        configId: 'config-1',
        userId: 'user-1',
      });

      expect(result.chat_id).toBe('test-id');
    });

    it('should throw error on failure', async () => {
      (database.query as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        chatService.createChat({
          configId: 'config-1',
          userId: 'user-1',
        })
      ).rejects.toThrow('Failed to create chat');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        message: 'Hello',
        metadata: {},
      };

      // Mock Hume client method
      jest
        .spyOn(chatService as any, 'humeClient')
        .mockReturnValue({
          empathicVoice: {
            chat: {
              sendMessage: jest.fn().mockResolvedValue(mockResponse),
            },
          },
        });

      (database.query as jest.Mock).mockResolvedValue({
        rowCount: 1,
      });

      const result = await chatService.sendMessage({
        chatId: 'chat-1',
        message: 'Hi',
        audioEnabled: false,
      });

      expect(result.message).toBe('Hello');
    });
  });
});
```

---

## Main Application Entry Point

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import config from './config/env';
import { initializeHumeClient } from './config/hume';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { chatLimiter } from './middleware/rateLimit';
import chatRoutes from './routes/chat.routes';
import expressionRoutes from './routes/expression.routes';
import logger from './utils/logger';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(loggerMiddleware);

// Initialize Hume client
try {
  initializeHumeClient();
  logger.info('Hume client initialized');
} catch (error) {
  logger.error('Failed to initialize Hume client:', error);
  process.exit(1);
}

// Routes
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/expression', expressionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
```

---

## Timeline & Estimates

### Backend Development (8-12 days)

| Task | Hours | Days |
|------|-------|------|
| Setup & Configuration | 8-12 | 1-2 |
| Chat Service | 16-22 | 2-3 |
| Expression Service | 12-16 | 1.5-2 |
| API Routes | 12-16 | 1.5-2 |
| Database Setup | 8-12 | 1-2 |
| Authentication & Middleware | 12-16 | 1.5-2 |
| Error Handling & Optimization | 12-16 | 1.5-2 |
| Testing | 16-20 | 2-3 |
| **Total** | **96-130** | **8-12** |

---

## Resources

- [Hume AI Documentation](https://docs.hume.ai)
- [Express.js Documentation](https://expressjs.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Node.js Best Practices](https://nodejs.org/en/docs)

**Last Updated:** 2024
**Version:** 1.0
