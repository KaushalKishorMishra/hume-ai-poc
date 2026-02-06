# Hume AI Interviewer Bot - Documentation

Comprehensive documentation for the Hume AI Automated Interviewer Proof of Concept.

## 📚 Documentation Index

### Project Documentation

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | Project overview, quick start, and API reference |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Detailed implementation guide |

### Reference Documentation (Hume AI General)

| Folder | Description |
|--------|-------------|
| [cop-usage/](./cop-usage/) | Code-oriented Hume AI integration examples |
| [gem-usage/](./gem-usage/) | Additional Hume AI implementation patterns |

---

## 🏗️ Project Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | SQLite |
| **Voice** | Hume AI EVI (Empathic Voice Interface) |
| **SDK** | @humeai/voice-react |

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   App.tsx   │  │ VoiceChat   │  │ useInterviewState   │  │
│  │ (error UI)  │  │ (interview) │  │ (state machine)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│         └────────────────┼────────────────────┘              │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   session.ts API Client + useBeforeUnload Hook        │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────┐
│                     BACKEND (Express)                       │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │  server.ts  │  │ sessionManager  │  │  humeConfig    │   │
│  │ (endpoints) │  │ (concurrency)   │  │  humeAuth      │   │
│  └──────┬──────┘  └────────┬────────┘  └───────┬────────┘   │
│         │                  │                   │            │
│         ▼                  ▼                   ▼            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     db.ts (SQLite)                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Interview State Machine

```
                    ┌─────────────────────────────────────┐
                    │              IDLE                   │
                    └─────────────────┬───────────────────┘
                                      │ init()
                    ┌─────────────────▼───────────────────┐
                    │          INITIALIZING               │
                    └─────────────────┬───────────────────┘
                                      │ success
                    ┌─────────────────▼───────────────────┐
                    │              IDLE                   │
                    │         (with credentials)          │
                    └─────────────────┬───────────────────┘
                                      │ startInterview()
                    ┌─────────────────▼───────────────────┐
                    │           CONNECTING                │
                    └─────────────────┬───────────────────┘
                                      │ connected
                    ┌─────────────────▼───────────────────┐
                    │             READY                   │
                    └─────────────────┬───────────────────┘
                                      │ interviewStarted()
                    ┌─────────────────▼───────────────────┐
                    │          IN_PROGRESS                │
                    └───┬─────────────┬───────────────┬───┘
                        │             │               │
            completed() │   error     │    userEnded()│
                        ▼             ▼               ▼
              ┌─────────────┐ ┌───────────┐ ┌─────────────────┐
              │  COMPLETED  │ │   ERROR   │ │  DISCONNECTED   │
              └─────────────┘ └───────────┘ └─────────────────┘
```

---

## 📡 API Reference

### Session Endpoints

#### `POST /api/session/setup`
Initialize session with Hume credentials.

**Response:**
```json
{
  "accessToken": "eyJ...",
  "configId": "abc123"
}
```

#### `GET /api/session/capacity`
Check if new sessions can start.

**Response:**
```json
{
  "allowed": true,
  "activeCount": 2,
  "limit": 5
}
```

#### `POST /api/session/start`
Reserve a session slot.

**Request:**
```json
{
  "sessionId": "session-1234567890",
  "totalQuestions": 3
}
```

#### `POST /api/session/heartbeat`
Keep session alive.

**Request:**
```json
{
  "sessionId": "session-1234567890",
  "questionsAnswered": 2
}
```

#### `POST /api/session/end`
Release session slot.

**Request:**
```json
{
  "sessionId": "session-1234567890"
}
```

#### `POST /api/session/record`
Save interview record.

**Request:**
```json
{
  "chatGroupId": "session-1234567890",
  "transcript": [...],
  "status": "COMPLETED",
  "disconnectReason": "completed",
  "questionsAnswered": 3,
  "totalQuestions": 3,
  "durationMs": 180000,
  "errorReason": null
}
```

---

## ⚠️ Error Handling

### Error Reasons

| Reason | Description | Recoverable |
|--------|-------------|-------------|
| `NETWORK_ERROR` | Connection lost | Yes |
| `AUTH_ERROR` | Token expired/invalid | Refresh page |
| `MICROPHONE_ERROR` | Mic access denied | Check settings |
| `USER_ENDED_EARLY` | User clicked end | Yes |
| `TAB_CLOSED` | Browser tab closed | N/A |
| `CONCURRENT_LIMIT_EXCEEDED` | Too many users | Wait & retry |
| `SERVER_ERROR` | Backend error | Yes |
| `SESSION_TIMEOUT` | Inactive too long | Yes |

### Tab Close Handling

When user closes tab during interview:
1. `beforeunload` event fires
2. `useBeforeUnload` hook triggers
3. `navigator.sendBeacon()` sends data to `/api/session/record`
4. Interview saved with `disconnect_reason: 'tab_closed'`

---

## 🔒 Security

### API Key Protection
- Hume API key and secret stored only on backend
- Frontend receives short-lived access tokens
- Token exchange via OAuth2 client credentials flow

### Session Management
- Concurrent session limits prevent resource exhaustion
- Stale session cleanup every 60 seconds
- Heartbeat required to keep session alive

### Error Messages
- No sensitive data in error responses
- Generic messages for unknown errors
- Detailed logging on server only

---

## 🧪 Development

### Running Locally

```bash
# Terminal 1: Backend
cd backend
yarn dev

# Terminal 2: Frontend
cd frontend
yarn dev
```

### Type Checking

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### Database Reset

```bash
curl -X POST http://localhost:3001/api/reset
```

---

## 📦 Deployment

### Environment Variables

**Backend (.env):**
```bash
HUME_API_KEY=your_api_key
HUME_SECRET_KEY=your_secret_key
PORT=3001
MAX_CONCURRENT_SESSIONS=5
SESSION_STALE_TIMEOUT_MS=300000
```

### Build Commands

```bash
# Backend
cd backend && yarn build

# Frontend
cd frontend && yarn build
```

---

## 📝 Changelog

### Latest Updates
- ✅ Added interview state management with stages
- ✅ Added question progress tracking
- ✅ Added loading indicators for all operations
- ✅ Added error handling for network issues, early disconnect, tab close
- ✅ Added concurrent session limits
- ✅ Enhanced interview records with metadata
- ✅ Fixed all TypeScript type errors
- ✅ Sanitized codebase (removed `any` types)

---

**Last Updated:** 2024
**Status:** Production Ready
