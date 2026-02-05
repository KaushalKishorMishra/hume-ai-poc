# Hume AI Integration - Master Implementation Guide

A comprehensive guide for integrating Hume AI TypeScript SDK into your application.

**Source Documentation:** [cop-usage](./cop-usage/README.md)
**Estimated Timeline:** 12-15 days (with AI assistance)
**Complexity:** Intermediate to Advanced

---

## Table of Contents

1. [Quick Start (30 Minutes)](#quick-start-30-minutes)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Foundation Setup](#phase-1-foundation-setup-days-1-3)
4. [Phase 2: Secure Webhooks](#phase-2-secure-webhooks-days-4-6)
5. [Phase 3: Speech-to-Speech](#phase-3-speech-to-speech-days-7-9)
6. [Phase 4: Production Deployment](#phase-4-production-deployment-days-10-12)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [External Resources](#external-resources)

---

## Quick Start (30 Minutes)

Get a basic Hume AI integration running locally in 30 minutes.

### Prerequisites
- Node.js 16+
- npm or yarn
- A Hume AI API key ([Get one here](https://dev.hume.ai))

### Step 1: Install Dependencies (2 minutes)

```bash
npm install hume axios express dotenv cors
npm install -D typescript @types/express ts-node nodemon
```

### Step 2: Environment Setup (3 minutes)

Create `.env`:
```bash
HUME_API_KEY=your_api_key_here
HUME_CONFIG_ID=your_config_id
PORT=3001
NODE_ENV=development
```

### Step 3: Basic Server (10 minutes)

Create `src/index.ts`:
```typescript
import express from 'express';
import dotenv from 'dotenv';
import Hume from 'hume';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Hume client
const humeClient = new Hume({
  apiKey: process.env.HUME_API_KEY!,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hume-ai-integration' });
});

// Create chat endpoint
app.post('/api/chat/create', async (req, res) => {
  try {
    const chat = await humeClient.empathicVoice.chats.create({
      configId: process.env.HUME_CONFIG_ID!,
    });
    res.json({ chatId: chat.id, status: 'created' });
  } catch (error) {
    console.error('Failed to create chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Send message endpoint
app.post('/api/chat/send', async (req, res) => {
  try {
    const { chatId, message } = req.body;

    const response = await humeClient.empathicVoice.chat(
      chatId
    ).sendMessage({
      type: 'user_input',
      text: message,
    });

    res.json({
      message: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 4: Test (5 minutes)

```bash
# Start server
npx ts-node src/index.ts

# Test in another terminal
curl -X POST http://localhost:3001/api/chat/create
curl -X POST http://localhost:3001/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"chatId": "your-chat-id", "message": "Hello!"}'
```

### Step 5: Next Steps

- Move to [Phase 1: Foundation Setup](#phase-1-foundation-setup-days-1-3) for full implementation
- See [Backend Implementation Details](./cop-usage/BACKEND_IMPLEMENTATION.md) for complete structure
- See [Code Examples](./cop-usage/CODE_EXAMPLES.md) for more endpoints

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │   React App     │  │   Web Audio API │  │   Speech Recog  │          │
│  │   (Frontend)    │  │   (Microphone)  │  │   (STT/TTS)     │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
└───────────┼────────────────────┼────────────────────┼──────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Express)                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Middleware: Auth, Rate Limiting, Error Handling, Logging       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ /api/chat    │ │ /api/speech  │ │ /api/webhooks│ │ /api/config  │   │
│  │   Routes     │ │   Routes     │ │   Routes     │ │   Routes     │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  ChatService     │  │  SpeechService   │  │  WebhookService  │       │
│  │  - createChat    │  │  - transcribe    │  │  - verifySig     │       │
│  │  - sendMessage   │  │  - synthesize    │  │  - handleEvent   │       │
│  │  - endChat       │  │  - processAudio  │  │  - retryLogic    │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
└───────────┼─────────────────────┼─────────────────────┼────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Hume AI    │  │  Google Cloud│  │   Database   │  │   Webhook    │ │
│  │   API        │  │  (STT/TTS)   │  │ (PostgreSQL) │  │   Delivery   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
1. **Backend-Proxy Pattern** - API key never exposed to frontend
2. **Service Layer** - Business logic isolated from HTTP layer
3. **Webhook Security** - Signed URLs with HMAC verification
4. **State Persistence** - Chat history stored in PostgreSQL

---

## Phase 1: Foundation Setup (Days 1-3)

### Day 1: Project Structure & Configuration

**Directory Structure:**
```
project/
├── src/
│   ├── config/
│   │   ├── env.ts              # Environment variables
│   │   ├── database.ts         # DB connection
│   │   └── hume.ts             # Hume client setup
│   ├── services/
│   │   ├── chatService.ts      # Chat business logic
│   │   └── expressionService.ts # Expression analysis
│   ├── routes/
│   │   ├── chat.routes.ts      # Chat endpoints
│   │   └── health.routes.ts    # Health checks
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication
│   │   ├── errorHandler.ts     # Global error handling
│   │   └── logger.ts           # Request logging
│   ├── models/
│   │   ├── Chat.ts             # Chat model
│   │   └── Message.ts          # Message model
│   ├── utils/
│   │   └── helpers.ts          # Utility functions
│   └── index.ts                # Entry point
├── tests/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

**Configuration Files:**

See [BACKEND_IMPLEMENTATION.md](./cop-usage/BACKEND_IMPLEMENTATION.md) for complete:
- `src/config/env.ts` - Environment validation
- `src/config/hume.ts` - Client initialization
- `src/config/database.ts` - PostgreSQL setup

### Day 2: Chat Service Implementation

**Core Chat Service** (`src/services/chatService.ts`):

```typescript
import Hume from 'hume';
import { query } from '../config/database';

export class ChatService {
  private client: Hume;

  constructor(apiKey: string) {
    this.client = new Hume({ apiKey });
  }

  async createChat(configId: string, userId: string) {
    const chat = await this.client.empathicVoice.chats.create({
      configId,
    });

    // Persist to database
    await query(
      `INSERT INTO chats (chat_id, user_id, config_id, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [chat.id, userId, configId, 'active']
    );

    return chat;
  }

  async sendMessage(chatId: string, message: string) {
    const response = await this.client.empathicVoice
      .chat(chatId)
      .sendMessage({
        type: 'user_input',
        text: message,
      });

    // Store interaction
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

  async endChat(chatId: string) {
    await this.client.empathicVoice.chats.delete(chatId);

    await query(
      `UPDATE chats SET status = $1, ended_at = NOW() WHERE chat_id = $2`,
      ['closed', chatId]
    );
  }
}
```

**Database Schema:**

```sql
-- Chats table
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  config_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  webhook_url TEXT,
  webhook_started_at TIMESTAMP,
  webhook_ended_at TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(255) REFERENCES chats(chat_id),
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
```

### Day 3: API Routes & Frontend Component

**Express Routes** (`src/routes/chat.routes.ts`):

See [HUME_AI_IMPLEMENTATION.md](./cop-usage/HUME_AI_IMPLEMENTATION.md) for complete route examples.

**React Component** (`components/EmpathicVoiceChat.tsx`):

See [FRONTEND_IMPLEMENTATION.md](./cop-usage/FRONTEND_IMPLEMENTATION.md) for the full chat UI component.

**Key Features:**
- Message display with timestamps
- Audio toggle for voice responses
- Auto-scroll to latest message
- Error handling with toast notifications
- Chat history loading

---

## Phase 2: Secure Webhooks (Days 4-6)

### Why Signed URLs?

Webhooks without verification are vulnerable to:
- Replay attacks
- Spoofed requests
- Unauthorized access

**Signed URLs provide:**
- Cryptographic proof of origin
- Time-limited validity
- Tamper detection

### Implementation

**Step 1: SignedUrlGenerator** (`src/utils/signedUrl.ts`):

```typescript
import crypto from 'crypto';
import { URL } from 'url';

export class SignedUrlGenerator {
  constructor(
    private secret: string,
    private baseUrl: string
  ) {}

  generateSignedUrl(options: {
    path: string;
    expiresIn?: number;
    queryParams?: Record<string, any>;
  }): string {
    const { path, expiresIn = 3600, queryParams = {} } = options;

    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + expiresIn;

    const params = {
      ...queryParams,
      timestamp,
      expiresAt,
    };

    // Create signature
    const canonical = `POST\n${path}\n${Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&')}`;

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

      // Verify signature
      const canonical = `POST\n${url.pathname}\n${Object.keys(params)
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('&')}`;

      const expectedSig = crypto
        .createHmac('sha256', this.secret)
        .update(canonical)
        .digest('hex');

      const valid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
      );

      return { valid, expired: false, data: params };
    } catch {
      return { valid: false, expired: false };
    }
  }
}
```

**Step 2: Webhook Routes** (`src/routes/webhooks.routes.ts`):

See [WEBHOOK_SIGNED_URLS_SPEECH_TO_SPEECH.md](./cop-usage/WEBHOOK_SIGNED_URLS_SPEECH_TO_SPEECH.md) for complete implementation.

**Step 3: Environment Variables:**

```bash
WEBHOOK_BASE_URL=https://yourdomain.com/api/webhooks
WEBHOOK_SECRET=your_secure_random_string_min_32_chars
```

### Webhook Event Handling

**Supported Events:**
- `chat.started` - Chat session initiated
- `chat.ended` - Chat session completed
- `chat.message` - New message received
- `chat.error` - Error occurred

See [CODE_EXAMPLES.md](./cop-usage/CODE_EXAMPLES.md) for complete webhook handler examples.

---

## Phase 3: Speech-to-Speech (Days 7-9)

### Architecture

```
User Speech → MediaRecorder → Backend → Google STT → Hume AI → Google TTS → Audio Playback
```

### Frontend: Audio Recording

```typescript
// Audio recording hook
export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      // Send to backend
      await sendAudioToBackend(audioBlob);
      chunksRef.current = [];
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return { isRecording, startRecording, stopRecording };
};
```

### Backend: Speech Processing

**SpeechService** (`src/services/speechService.ts`):

See [CODE_EXAMPLES.md](./cop-usage/CODE_EXAMPLES.md) for complete speech-to-speech service implementation.

**Key Methods:**
- `processAudioMessage()` - Full speech-to-speech pipeline
- `transcribeAudio()` - Google Cloud STT integration
- `synthesizeSpeech()` - Google Cloud TTS integration

### API Endpoints

```typescript
// Send audio message
app.post('/api/speech-to-speech/send-audio', authenticate, upload.single('audio'), async (req, res) => {
  const { chatId } = req.body;
  const audioBuffer = req.file?.buffer;

  const result = await speechService.processAudioMessage(
    chatId,
    audioBuffer,
    req.file?.mimetype || 'audio/webm'
  );

  res.json({
    transcription: result.transcription,
    message: result.message,
    audioUrl: result.audioUrl
  });
});
```

---

## Phase 4: Production Deployment (Days 10-12)

### Pre-Deployment Checklist

- [ ] HTTPS enabled on all endpoints
- [ ] Webhook signatures verified
- [ ] Secrets in environment variables (not code)
- [ ] Rate limiting implemented (100 req/min)
- [ ] Database connection pooling configured
- [ ] Error tracking configured (Sentry)
- [ ] Logging implemented (no secrets in logs)
- [ ] Health check endpoint active
- [ ] Database backups scheduled
- [ ] Monitoring alerts configured

### Security Checklist

See [Security Best Practices](#security-best-practices) section below.

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@prod-db:5432/hume_ai
HUME_API_KEY=live_api_key_here
HUME_CONFIG_ID=production_config_id
JWT_SECRET=strong_random_secret_min_64_chars
WEBHOOK_BASE_URL=https://api.yourdomain.com/api/webhooks
WEBHOOK_SECRET=webhook_secret_min_32_chars
LOG_LEVEL=warn
```

---

## Security Best Practices

### 1. API Key Protection

**NEVER** expose the Hume API key in frontend code. Always proxy through backend.

```typescript
// ❌ BAD: API key in frontend
const client = new Hume({ apiKey: 'sk_live_...' });

// ✅ GOOD: Backend proxy
const response = await fetch('/api/chat/send', {
  method: 'POST',
  body: JSON.stringify({ message })
});
```

### 2. Webhook Signature Verification

**ALWAYS** verify webhook signatures in production:

```typescript
const verification = signedUrlGenerator.verifySignedUrl(fullUrl);
if (!verification.valid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### 3. HTTPS Enforcement

```typescript
// Redirect HTTP to HTTPS
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(301, `https://${req.headers.host}${req.url}`);
}
```

### 4. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);
```

### 5. Input Validation

```typescript
import { z } from 'zod';

const sendMessageSchema = z.object({
  chatId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  audioEnabled: z.boolean().optional()
});

app.post('/api/chat/send', (req, res, next) => {
  try {
    req.body = sendMessageSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
});
```

### 6. Secure Logging

```typescript
// ❌ BAD: Logging sensitive data
logger.info('User login', { apiKey: process.env.HUME_API_KEY });

// ✅ GOOD: Sanitized logging
logger.info('Chat created', { chatId, userId, timestamp: new Date() });
```

---

## Troubleshooting

### Common Issues

#### "Invalid webhook signature"
- Ensure webhook secret is 32+ characters
- Check secret matches exactly in `.env`
- Verify URL hasn't expired (check `expiresAt` parameter)

#### "Speech recognition not working"
- Check browser support (Chrome/Edge recommended)
- Ensure HTTPS in production (required for microphone)
- Verify microphone permissions granted

#### "Audio playback delayed"
- Compress audio files before transmission
- Implement audio streaming instead of full download
- Use CDN for audio file hosting

#### "Database connection errors"
- Verify `DATABASE_URL` format
- Check connection pool settings (min: 5, max: 20)
- Ensure database server is accessible from app

### Debugging Commands

```bash
# Test webhook signature generation
curl -X POST http://localhost:3001/api/webhooks/generate-signed-url \
  -H "Content-Type: application/json" \
  -d '{"eventType": "chat.ended", "expiresIn": 3600}'

# Test chat creation
curl -X POST http://localhost:3001/api/chat/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM chats;"
```

---

## External Resources

### Official Documentation
- [Hume AI Docs](https://docs.hume.ai)
- [TypeScript SDK GitHub](https://github.com/HumeAI/hume-typescript-sdk)
- [API Reference](https://docs.hume.ai/api)

### Related Technologies
- [Express.js](https://expressjs.com)
- [React](https://react.dev)
- [PostgreSQL](https://www.postgresql.org/docs)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech)

### Source Files (Local)
- [Complete Implementation Guide](./cop-usage/HUME_AI_IMPLEMENTATION.md)
- [Backend Implementation](./cop-usage/BACKEND_IMPLEMENTATION.md)
- [Frontend Implementation](./cop-usage/FRONTEND_IMPLEMENTATION.md)
- [Webhook Security Guide](./cop-usage/WEBHOOK_SIGNED_URLS_SPEECH_TO_SPEECH.md)
- [Code Examples](./cop-usage/CODE_EXAMPLES.md)
- [Quick Start Guide](./cop-usage/QUICK_START_GUIDE.md)

---

## Implementation Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Foundation | 3 days | Project structure, chat service, basic UI |
| Phase 2: Webhooks | 3 days | Signed URL generator, webhook handlers, security |
| Phase 3: Speech | 3 days | Audio recording, STT/TTS integration |
| Phase 4: Production | 3+ days | Testing, deployment, monitoring |
| **TOTAL** | **12-15 days** | Full production-ready implementation |

---

**Last Updated:** 2026-02-04
**SDK Version:** Latest (v0.15.11+)
**Status:** Production Ready
