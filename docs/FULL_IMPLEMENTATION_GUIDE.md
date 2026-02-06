# Hume AI - Complete Full-Stack Implementation Guide

> ⚠️ **Note:** This is a **general reference guide** for Hume AI full-stack integration. For the specific Interviewer Bot PoC implementation in this project, see the [main project README](../README.md) and [Implementation Guide](./IMPLEMENTATION_GUIDE.md).

A comprehensive, production-ready implementation guide for Hume AI with both frontend (React) and backend (Node.js/Express) code.

**Timeline:** 12-15 days
**Complexity:** Intermediate
**Stack:** React + TypeScript + Node.js + Express + PostgreSQL

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Day 1-3: Foundation](#day-1-3-foundation)
   - [Backend Setup](#backend-setup-day-1)
   - [Frontend Setup](#frontend-setup-day-2)
   - [Integration](#integration-day-3)
3. [Day 4-6: Secure Webhooks](#day-4-6-secure-webhooks)
4. [Day 7-9: Speech-to-Speech](#day-7-9-speech-to-speech)
5. [Day 10-12: Production](#day-10-12-production)
6. [Complete Code Reference](#complete-code-reference)

---

## Project Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REACT FRONTEND                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Components:                                                     │   │
│  │  • ChatInterface.tsx       - Main chat UI                       │   │
│  │  • AudioRecorder.tsx       - Voice input recording              │   │
│  │  • MessageList.tsx         - Message display                    │   │
│  │  • ExpressionMeter.tsx     - Emotion visualization              │   │
│  └────────────────────┬─────────────────────────────────────────────┘   │
│                       │ HTTP/WebSocket                                 │
└───────────────────────┼─────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────────┐
│                      EXPRESS BACKEND                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Routes:                                                         │   │
│  │  • POST /api/chat/create          - Initialize chat             │   │
│  │  • POST /api/chat/send            - Send message                │   │
│  │  • POST /api/speech/send-audio    - Speech-to-speech            │   │
│  │  • POST /api/webhooks/chat-event  - Webhook receiver            │   │
│  └────────────────────┬─────────────────────────────────────────────┘   │
│                       │                                                │
│  ┌────────────────────▼───────────────────────────────────────────┐    │
│  │  Services:                                                     │    │
│  │  • ChatService        - Hume API wrapper                      │    │
│  │  • SpeechService      - STT/TTS processing                    │    │
│  │  • WebhookService     - Signed URL verification               │    │
│  └────────────────────┬───────────────────────────────────────────┘    │
└───────────────────────┼─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Hume AI    │ │  PostgreSQL  │ │   Webhook    │
│    API       │ │   Database   │ │   Events     │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Day 1-3: Foundation

### Backend Setup (Day 1)

#### 1. Initialize Project

```bash
mkdir hume-ai-backend
cd hume-ai-backend
npm init -y

# Core dependencies
npm install express dotenv cors helmet morgan
npm install hume axios pg zod
npm install -D typescript @types/express @types/node @types/pg
npm install -D ts-node nodemon jest @types/jest

# Initialize TypeScript
npx tsc --init
```

#### 2. Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts              # Environment variables
│   │   ├── database.ts         # PostgreSQL connection
│   │   └── hume.ts             # Hume client setup
│   ├── services/
│   │   ├── chatService.ts      # Chat business logic
│   │   ├── speechService.ts    # Speech-to-speech logic
│   │   └── webhookService.ts   # Webhook handling
│   ├── routes/
│   │   ├── chat.routes.ts      # Chat endpoints
│   │   ├── speech.routes.ts    # Speech endpoints
│   │   └── webhook.routes.ts   # Webhook endpoints
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication
│   │   ├── errorHandler.ts     # Global error handler
│   │   └── validate.ts         # Input validation
│   ├── utils/
│   │   ├── signedUrl.ts        # Signed URL generator
│   │   └── logger.ts           # Logging utility
│   ├── types/
│   │   └── index.ts            # Type definitions
│   └── index.ts                # Entry point
├── tests/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

#### 3. Configuration Files

**`src/config/env.ts`**
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  DATABASE_URL: z.string(),
  HUME_API_KEY: z.string(),
  HUME_CONFIG_ID: z.string(),
  JWT_SECRET: z.string(),
  WEBHOOK_BASE_URL: z.string(),
  WEBHOOK_SECRET: z.string(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
```

**`src/config/database.ts`**
```typescript
import { Pool } from 'pg';
import { config } from './env';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Initialize tables
export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        config_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        webhook_url TEXT,
        webhook_started_at TIMESTAMP,
        webhook_ended_at TIMESTAMP,
        duration_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(255) REFERENCES chats(chat_id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        audio_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS webhook_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100),
        chat_id VARCHAR(255),
        payload JSONB,
        signature_valid BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_chat_id ON webhook_logs(chat_id);
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
};
```

**`src/config/hume.ts`**
```typescript
import Hume from 'hume';
import { config } from './env';

let humeClient: Hume | null = null;

export const getHumeClient = (): Hume => {
  if (!humeClient) {
    humeClient = new Hume({
      apiKey: config.HUME_API_KEY,
    });
  }
  return humeClient;
};
```

#### 4. Services

**`src/services/chatService.ts`**
```typescript
import { getHumeClient } from '../config/hume';
import { query } from '../config/database';

export class ChatService {
  private client = getHumeClient();

  async createChat(configId: string, userId: string, webhookUrl?: string) {
    const chat = await this.client.empathicVoice.chats.create({
      configId,
    });

    await query(
      `INSERT INTO chats (chat_id, user_id, config_id, status, webhook_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [chat.id, userId, configId, 'active', webhookUrl || null]
    );

    return chat;
  }

  async sendMessage(chatId: string, message: string) {
    const chat = await this.client.empathicVoice.chat(chatId);

    const response = await chat.sendMessage({
      type: 'user_input',
      text: message,
    });

    // Store user message
    await query(
      `INSERT INTO messages (chat_id, role, content, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [chatId, 'user', message]
    );

    return response;
  }

  async getChatHistory(chatId: string) {
    const result = await query(
      `SELECT * FROM messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId]
    );
    return result.rows;
  }

  async getUserChats(userId: string) {
    const result = await query(
      `SELECT * FROM chats
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async endChat(chatId: string) {
    await this.client.empathicVoice.chats.delete(chatId);

    await query(
      `UPDATE chats
       SET status = $1, ended_at = NOW()
       WHERE chat_id = $2`,
      ['closed', chatId]
    );
  }
}

export const chatService = new ChatService();
```

**`src/utils/signedUrl.ts`**
```typescript
import crypto from 'crypto';
import { URL } from 'url';
import { config } from '../config/env';

export interface SignedUrlOptions {
  path: string;
  expiresIn?: number; // seconds, default 3600
  method?: string;
  queryParams?: Record<string, any>;
}

export class SignedUrlGenerator {
  constructor(
    private secret: string = config.WEBHOOK_SECRET,
    private baseUrl: string = config.WEBHOOK_BASE_URL
  ) {}

  generateSignedUrl(options: SignedUrlOptions): string {
    const {
      expiresIn = 3600,
      method = 'POST',
      path,
      queryParams = {}
    } = options;

    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + expiresIn;

    const params: Record<string, any> = {
      ...queryParams,
      timestamp,
      expiresAt,
    };

    // Create canonical string for signing
    const sortedKeys = Object.keys(params).sort();
    const canonicalParams = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');
    const canonical = `${method}\n${path}\n${canonicalParams}`;

    // Generate signature
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(canonical)
      .digest('hex');

    params.signature = signature;

    // Build URL
    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    return url.toString();
  }

  verifySignedUrl(signedUrl: string): {
    valid: boolean;
    expired: boolean;
    data?: Record<string, any>;
  } {
    try {
      const url = new URL(signedUrl);
      const params = Object.fromEntries(url.searchParams);

      const signature = params.signature as string;
      delete params.signature;

      const expiresAt = parseInt(params.expiresAt as string, 10);
      const now = Math.floor(Date.now() / 1000);

      if (now > expiresAt) {
        return { valid: false, expired: true };
      }

      // Recreate canonical string
      const method = 'POST';
      const path = url.pathname;
      const sortedKeys = Object.keys(params).sort();
      const canonicalParams = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');
      const canonical = `${method}\n${path}\n${canonicalParams}`;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(canonical)
        .digest('hex');

      const valid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      return { valid, expired: false, data: params };
    } catch {
      return { valid: false, expired: false };
    }
  }
}

export const signedUrlGenerator = new SignedUrlGenerator();
```

#### 5. Routes

**`src/routes/chat.routes.ts`**
```typescript
import { Router } from 'express';
import { z } from 'zod';
import { chatService } from '../services/chatService';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const createChatSchema = z.object({
  configId: z.string().optional(),
  enableWebhook: z.boolean().optional(),
});

const sendMessageSchema = z.object({
  chatId: z.string(),
  message: z.string().min(1).max(1000),
});

// POST /api/chat/create
router.post(
  '/create',
  authenticate,
  validate(createChatSchema),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const configId = req.body.configId || process.env.HUME_CONFIG_ID;

      const chat = await chatService.createChat(configId, userId);

      res.json({
        success: true,
        chatId: chat.id,
        configId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/chat/send
router.post(
  '/send',
  authenticate,
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const { chatId, message } = req.body;

      const response = await chatService.sendMessage(chatId, message);

      res.json({
        success: true,
        chatId,
        response,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/chat/history/:chatId
router.get(
  '/history/:chatId',
  authenticate,
  async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const history = await chatService.getChatHistory(chatId);

      res.json({
        success: true,
        chatId,
        history,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/chat/list
router.get(
  '/list',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const chats = await chatService.getUserChats(userId);

      res.json({
        success: true,
        chats,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/chat/end
router.post(
  '/end',
  authenticate,
  async (req, res, next) => {
    try {
      const { chatId } = req.body;
      await chatService.endChat(chatId);

      res.json({
        success: true,
        message: 'Chat ended successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

**`src/routes/webhook.routes.ts`**
```typescript
import { Router } from 'express';
import { signedUrlGenerator } from '../utils/signedUrl';
import { query } from '../config/database';
import { config } from '../config/env';

const router = Router();

// POST /api/webhooks/generate-signed-url
router.post('/generate-signed-url', async (req, res) => {
  try {
    const { eventType, chatId, userId, expiresIn = 3600 } = req.body;

    const signedUrl = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      expiresIn,
      queryParams: {
        eventType,
        chatId,
        userId,
      },
    });

    res.json({
      success: true,
      signedUrl,
      expiresIn,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// POST /api/webhooks/chat-event (receives webhooks from Hume)
router.post('/chat-event', async (req, res) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const verification = signedUrlGenerator.verifySignedUrl(fullUrl);

    // Log webhook attempt
    await query(
      `INSERT INTO webhook_logs (event_type, chat_id, payload, signature_valid, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.body.type || 'unknown',
        req.body.chat_id || null,
        JSON.stringify(req.body),
        verification.valid,
      ]
    );

    if (!verification.valid) {
      if (verification.expired) {
        return res.status(401).json({ error: 'Webhook URL expired' });
      }
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle event
    const { type, chat_id, ...eventData } = req.body;

    switch (type) {
      case 'chat.started':
        await query(
          `UPDATE chats SET webhook_started_at = NOW() WHERE chat_id = $1`,
          [chat_id]
        );
        break;

      case 'chat.ended':
        await query(
          `UPDATE chats
           SET webhook_ended_at = NOW(),
               duration_ms = $1,
               status = 'closed'
           WHERE chat_id = $2`,
          [eventData.duration || 0, chat_id]
        );
        break;

      case 'chat.message':
        // Store assistant message
        if (eventData.role === 'assistant') {
          await query(
            `INSERT INTO messages (chat_id, role, content, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [chat_id, 'assistant', eventData.message]
          );
        }
        break;

      case 'chat.error':
        console.error('Chat error webhook:', eventData);
        break;
    }

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

#### 6. Middleware

**`src/middleware/auth.ts`**
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

**`src/middleware/validate.ts`**
```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
};
```

**`src/middleware/errorHandler.ts`**
```typescript
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Don't leak error details in production
  if (config.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.status(500).json({
    error: err.message,
    stack: err.stack,
  });
};
```

#### 7. Entry Point

**`src/index.ts`**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config/env';
import { initDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';

import chatRoutes from './routes/chat.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database connected');

    app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

**`.env`**
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/hume_ai
HUME_API_KEY=your_hume_api_key_here
HUME_CONFIG_ID=your_config_id_here
JWT_SECRET=your_jwt_secret_min_32_chars
WEBHOOK_BASE_URL=http://localhost:3001/api/webhooks
WEBHOOK_SECRET=your_webhook_secret_min_32_chars
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:3000
```

---

### Frontend Setup (Day 2)

#### 1. Initialize Project

```bash
npx create-react-app hume-ai-frontend --template typescript
cd hume-ai-frontend

# Core dependencies
npm install axios zustand react-hot-toast
npm install -D @types/node tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p
```

#### 2. Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx      # Main chat component
│   │   ├── MessageList.tsx        # Message display
│   │   ├── AudioRecorder.tsx      # Voice recording
│   │   ├── ChatSidebar.tsx        # Chat history list
│   │   └── LoadingSpinner.tsx     # Loading indicator
│   ├── hooks/
│   │   ├── useAuth.ts             # Authentication hook
│   │   ├── useChat.ts             # Chat operations hook
│   │   └── useAudioRecorder.ts    # Audio recording hook
│   ├── services/
│   │   └── api.ts                 # API client
│   ├── store/
│   │   └── chatStore.ts           # Zustand store
│   ├── types/
│   │   └── index.ts               # Type definitions
│   ├── App.tsx
│   └── index.tsx
├── public/
├── package.json
└── tsconfig.json
```

#### 3. Types

**`src/types/index.ts`**
```typescript
export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  chatId: string;
  configId: string;
  status: 'active' | 'closed';
  createdAt: string;
  endedAt?: string;
}

export interface User {
  id: string;
  email: string;
  token: string;
}
```

#### 4. API Client

**`src/services/api.ts`**
```typescript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const chatApi = {
  createChat: (configId?: string) =>
    api.post('/chat/create', { configId }),

  sendMessage: (chatId: string, message: string) =>
    api.post('/chat/send', { chatId, message }),

  getHistory: (chatId: string) =>
    api.get(`/chat/history/${chatId}`),

  getChats: () =>
    api.get('/chat/list'),

  endChat: (chatId: string) =>
    api.post('/chat/end', { chatId }),
};

export default api;
```

#### 5. State Management

**`src/store/chatStore.ts`**
```typescript
import { create } from 'zustand';
import { Message, Chat } from '../types';

interface ChatState {
  // Current chat
  currentChatId: string | null;
  messages: Message[];
  isLoading: boolean;

  // Chat list
  chats: Chat[];

  // Actions
  setCurrentChat: (chatId: string | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  clearCurrentChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentChatId: null,
  messages: [],
  isLoading: false,
  chats: [],

  setCurrentChat: (chatId) => set({ currentChatId: chatId }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) => set({ messages }),

  setLoading: (loading) => set({ isLoading: loading }),

  setChats: (chats) => set({ chats }),

  addChat: (chat) =>
    set((state) => ({
      chats: [chat, ...state.chats],
    })),

  clearCurrentChat: () =>
    set({ currentChatId: null, messages: [] }),
}));
```

#### 6. Custom Hooks

**`src/hooks/useChat.ts`**
```typescript
import { useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatApi } from '../services/api';
import { Message } from '../types';
import toast from 'react-hot-toast';

export const useChat = () => {
  const {
    currentChatId,
    messages,
    isLoading,
    setCurrentChat,
    addMessage,
    setMessages,
    setLoading,
  } = useChatStore();

  const createChat = useCallback(async (configId?: string) => {
    try {
      setLoading(true);
      const response = await chatApi.createChat(configId);
      const { chatId } = response.data;

      setCurrentChat(chatId);
      setMessages([]);

      toast.success('Chat created');
      return chatId;
    } catch (error) {
      toast.error('Failed to create chat');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setCurrentChat, setMessages, setLoading]);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentChatId) {
      toast.error('No active chat');
      return;
    }

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      chatId: currentChatId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);

    try {
      setLoading(true);
      const response = await chatApi.sendMessage(currentChatId, content);

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        chatId: currentChatId,
        role: 'assistant',
        content: response.data.response.message || 'No response',
        createdAt: new Date().toISOString(),
      };
      addMessage(assistantMessage);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  }, [currentChatId, addMessage, setLoading]);

  const loadHistory = useCallback(async (chatId: string) => {
    try {
      setLoading(true);
      const response = await chatApi.getHistory(chatId);
      setMessages(response.data.history);
      setCurrentChat(chatId);
    } catch (error) {
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [setMessages, setCurrentChat, setLoading]);

  return {
    currentChatId,
    messages,
    isLoading,
    createChat,
    sendMessage,
    loadHistory,
  };
};
```

**`src/hooks/useAudioRecorder.ts`**
```typescript
import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        chunksRef.current = [];

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
  }, []);

  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    clearAudio,
  };
};
```

#### 7. Components

**`src/components/ChatInterface.tsx`**
```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { AudioRecorder } from './AudioRecorder';
import { Send, Plus, Loader2 } from 'lucide-react';

export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    currentChatId,
    messages,
    isLoading,
    createChat,
    sendMessage,
  } = useChat();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleNewChat = async () => {
    await createChat();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Hume AI Chat</h1>
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={20} />
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {!currentChatId ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Welcome to Hume AI</p>
              <p>Click "New Chat" to start a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={messages} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {currentChatId && (
        <div className="bg-white border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <AudioRecorder
              onTranscript={(text) => sendMessage(text)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Send size={20} />
              )}
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
```

**`src/components/MessageList.tsx`**
```typescript
import React from 'react';
import { Message } from '../types';
import { User, Bot } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-3 ${
            message.role === 'user' ? 'flex-row-reverse' : ''
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div
            className={`max-w-[70%] px-4 py-2 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            <p>{message.content}</p>
            <span className="text-xs opacity-70">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

**`src/components/AudioRecorder.tsx`**
```typescript
import React, { useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscript,
  disabled,
}) => {
  const { isRecording, startRecording, stopRecording, audioBlob } =
    useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleToggle = async () => {
    if (isRecording) {
      stopRecording();
      // Wait for blob to be set
      setTimeout(async () => {
        if (audioBlob) {
          await transcribeAudio(audioBlob);
        }
      }, 100);
    } else {
      await startRecording();
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      // For demo, using Web Speech API
      // In production, send to backend for Google STT
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
      };

      recognition.start();
    } catch (error) {
      console.error('Transcription failed:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || isTranscribing}
      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
        isRecording
          ? 'bg-red-600 text-white animate-pulse'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      } disabled:opacity-50`}
    >
      {isRecording ? <Square size={20} /> : <Mic size={20} />}
      {isRecording ? 'Stop' : 'Voice'}
    </button>
  );
};
```

#### 8. App Component

**`src/App.tsx`**
```typescript
import React from 'react';
import { Toaster } from 'react-hot-toast';
import { ChatInterface } from './components/ChatInterface';

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" />
      <ChatInterface />
    </div>
  );
}

export default App;
```

**`.env`**
```bash
REACT_APP_API_URL=http://localhost:3001
```

---

### Integration Day (Day 3)

#### Testing the Integration

1. **Start Backend:**
```bash
cd hume-ai-backend
npm run dev
```

2. **Start Frontend:**
```bash
cd hume-ai-frontend
npm start
```

3. **Test Flow:**
   - Open http://localhost:3000
   - Click "New Chat"
   - Type a message and send
   - Verify response from Hume AI

---

## Day 4-6: Secure Webhooks

### Backend: Complete Webhook Implementation

Already implemented in foundation:
- `src/utils/signedUrl.ts` - Signed URL generator
- `src/routes/webhook.routes.ts` - Webhook endpoints

### Testing Webhooks with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3001

# Update .env with ngrok URL
WEBHOOK_BASE_URL=https://your-ngrok-id.ngrok.io/api/webhooks

# Test webhook generation
curl -X POST http://localhost:3001/api/webhooks/generate-signed-url \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "chat.ended",
    "chatId": "test-chat-123",
    "expiresIn": 3600
  }'
```

---

## Day 7-9: Speech-to-Speech

### Backend: Speech Service

**`src/services/speechService.ts`**
```typescript
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getHumeClient } from '../config/hume';

export class SpeechService {
  private speechClient = new SpeechClient();
  private ttsClient = new TextToSpeechClient();
  private humeClient = getHumeClient();

  async speechToText(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const audio = {
      content: audioBuffer.toString('base64'),
    };

    const config = {
      encoding: 'WEBM_OPUS' as const,
      sampleRateHertz: 48000,
      languageCode: 'en-US',
    };

    const [response] = await this.speechClient.recognize({
      audio,
      config,
    });

    const transcription =
      response.results?.[0]?.alternatives?.[0]?.transcript || '';
    return transcription;
  }

  async textToSpeech(text: string): Promise<Buffer> {
    const request = {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' as const },
      audioConfig: { audioEncoding: 'MP3' as const },
    };

    const [response] = await this.ttsClient.synthesizeSpeech(request);
    return Buffer.from(response.audioContent as string, 'base64');
  }

  async processAudioMessage(
    chatId: string,
    audioBuffer: Buffer,
    mimeType: string
  ) {
    // 1. Transcribe audio
    const transcription = await this.speechToText(audioBuffer, mimeType);

    // 2. Send to Hume
    const chat = this.humeClient.empathicVoice.chat(chatId);
    const response = await chat.sendMessage({
      type: 'user_input',
      text: transcription,
    });

    // 3. Synthesize response
    const assistantText = response.message || '';
    const audioContent = await this.textToSpeech(assistantText);

    return {
      transcription,
      message: assistantText,
      audioContent,
    };
  }
}

export const speechService = new SpeechService();
```

### Frontend: Full Audio Support

Add to `AudioRecorder.tsx`:
- Upload recorded audio to backend
- Play back audio responses

---

## Day 10-12: Production

### Environment Variables

**Backend `.env.production`:**
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@prod-db:5432/hume_ai
HUME_API_KEY=live_api_key
HUME_CONFIG_ID=production_config
JWT_SECRET=strong_secret_min_64_chars
WEBHOOK_BASE_URL=https://api.yourdomain.com/api/webhooks
WEBHOOK_SECRET=webhook_secret_min_32_chars
LOG_LEVEL=warn
```

**Frontend `.env.production`:**
```bash
REACT_APP_API_URL=https://api.yourdomain.com
```

### Security Checklist

- [ ] HTTPS enabled everywhere
- [ ] Webhook signatures verified
- [ ] Rate limiting: 100 req/min per IP
- [ ] JWT tokens expire after 24 hours
- [ ] CORS restricted to production domain
- [ ] Database connection pooling (max 20)
- [ ] Error messages don't leak sensitive info
- [ ] Secrets in environment variables only
- [ ] No API keys in frontend code
- [ ] Helmet.js for security headers

### Docker Deployment

**`backend/Dockerfile`:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/hume_ai
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=hume_ai
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Complete Code Reference

### All Files Summary

| File | Purpose |
|------|---------|
| `backend/src/config/env.ts` | Environment configuration |
| `backend/src/config/database.ts` | PostgreSQL setup |
| `backend/src/config/hume.ts` | Hume client |
| `backend/src/services/chatService.ts` | Chat logic |
| `backend/src/services/speechService.ts` | STT/TTS logic |
| `backend/src/routes/chat.routes.ts` | Chat API |
| `backend/src/routes/webhook.routes.ts` | Webhook API |
| `backend/src/utils/signedUrl.ts` | URL signing |
| `backend/src/middleware/auth.ts` | JWT auth |
| `frontend/src/services/api.ts` | HTTP client |
| `frontend/src/store/chatStore.ts` | State management |
| `frontend/src/hooks/useChat.ts` | Chat operations |
| `frontend/src/hooks/useAudioRecorder.ts` | Audio recording |
| `frontend/src/components/ChatInterface.tsx` | Main UI |
| `frontend/src/components/MessageList.tsx` | Messages |
| `frontend/src/components/AudioRecorder.tsx` | Voice input |

### Quick Commands

```bash
# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm start

# Build for production
cd backend && npm run build
cd frontend && npm run build

# Run with Docker
docker-compose up -d
```

---

## Support & Resources

- [Hume AI Documentation](https://docs.hume.ai)
- [TypeScript SDK](https://github.com/HumeAI/hume-typescript-sdk)
- Original detailed docs in `cop-usage/` folder

---

**Last Updated:** 2026-02-04
**Version:** 1.0
**Status:** Production Ready
