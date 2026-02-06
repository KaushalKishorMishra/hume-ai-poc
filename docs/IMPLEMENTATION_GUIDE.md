# Hume AI Interviewer Bot - Implementation Guide

A step-by-step guide for understanding and extending the Hume AI Interviewer Bot PoC.

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [State Management](#state-management)
5. [Error Handling](#error-handling)
6. [Concurrent Session Management](#concurrent-session-management)
7. [Extending the Project](#extending-the-project)

---

## Overview

### How It Works

1. **Session Setup**: Frontend requests access token from backend
2. **Capacity Check**: Frontend verifies session slots are available
3. **WebSocket Connection**: Frontend connects to Hume EVI with questions
4. **Interview Flow**: Bot asks questions, user responds, progress is tracked
5. **Completion**: Interview ends (normally or early), data is saved

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend  | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend   | Node.js + Express + TypeScript |
| Database  | SQLite (via better-sqlite3) |
| Voice SDK | @humeai/voice-react |
| Auth      | OAuth2 Client Credentials (server-side) |

---

## Backend Implementation

### Project Structure

```
backend/
├── src/
│   ├── server.ts              # Main Express server
│   ├── db.ts                  # SQLite database operations
│   ├── routes/
│   │   └── hume.ts            # Hume config management API
│   ├── services/
│   │   ├── humeAuth.ts        # OAuth2 token exchange
│   │   ├── humeConfig.ts      # EVI config CRUD operations
│   │   └── sessionManager.ts  # Concurrent session tracking
│   └── types/
│       └── hume.ts            # TypeScript interfaces
├── package.json
└── tsconfig.json
```

### Key Files

#### `server.ts` - Main Application

The Express server with all endpoints:

```typescript
// Session setup - returns access token and config ID
app.post("/api/session/setup", async (req, res) => {
  // 1. Check/create EVI config on Hume
  // 2. Get OAuth2 access token
  // 3. Return { accessToken, configId }
});

// Capacity check - can we start new sessions?
app.get("/api/session/capacity", (req, res) => {
  const capacity = sessionManager.getCapacity();
  res.json(capacity);
});

// Start session - reserve a slot
app.post("/api/session/start", (req, res) => {
  const { sessionId, totalQuestions } = req.body;
  const success = sessionManager.startSession(sessionId, totalQuestions);
  // Returns success or 429 if limit reached
});

// Record interview - save with full metadata
app.post("/api/session/record", async (req, res) => {
  const { chatGroupId, transcript, status, disconnectReason, ... } = req.body;
  await saveInterview(record);
});
```

#### `sessionManager.ts` - Concurrency Control

```typescript
class SessionManager {
  private sessions: Map<string, ActiveSession> = new Map();
  private maxConcurrent = 5; // From env

  getCapacity() {
    return {
      allowed: this.sessions.size < this.maxConcurrent,
      activeCount: this.sessions.size,
      limit: this.maxConcurrent
    };
  }

  startSession(sessionId: string, totalQuestions: number) {
    if (this.sessions.size >= this.maxConcurrent) return false;
    this.sessions.set(sessionId, { /* session details */ });
    return true;
  }

  endSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
```

#### `db.ts` - Database Operations

```typescript
export interface InterviewRecord {
  chatGroupId: string;
  transcript: unknown[];
  status: 'COMPLETED' | 'INCOMPLETE' | 'ERROR';
  disconnectReason: string | null;
  questionsAnswered: number;
  totalQuestions: number;
  durationMs: number;
  errorReason?: string;
}

export const saveInterview = async (record: InterviewRecord) => {
  // Auto-migrate schema if needed
  // Insert with all metadata
};
```

---

## Frontend Implementation

### Project Structure

```
frontend/
├── src/
│   ├── App.tsx                # Main app with loading/error UI
│   ├── main.tsx               # Entry point
│   ├── index.css              # Tailwind styles
│   ├── components/
│   │   ├── VoiceChat.tsx      # Core interview component
│   │   └── ArchitectureView.tsx
│   ├── hooks/
│   │   ├── useInterviewState.ts  # State machine
│   │   ├── useBeforeUnload.ts    # Tab close handler
│   │   └── index.ts
│   ├── api/
│   │   └── session.ts         # API client
│   ├── utils/
│   │   └── errorMapper.ts     # Error categorization
│   └── types/
│       ├── index.ts           # Core types
│       └── interview.ts       # State types
├── package.json
└── vite.config.ts
```

### Key Files

#### `VoiceChat.tsx` - Interview Logic

```typescript
const INTERVIEW_QUESTIONS = [
  "Tell me about your most challenging project.",
  "How do you stay updated with the latest technology trends?",
  "Describe a time you had to learn something very quickly.",
];

export const VoiceChat = ({ accessToken, configId, interview, onError }) => {
  const { state, actions, computed } = interview;
  const { connect, disconnect, messages } = useVoice();

  // Auto-start interview when connected
  useEffect(() => {
    if (connected && stage === READY) {
      sendUserInput("Start the interview");
      actions.interviewStarted();
    }
  }, [connected]);

  // Track question progress
  useEffect(() => {
    // Detect when bot asks a question
    // Detect when user answers
    // Update progress
  }, [messages]);

  // Handle completion signal
  useEffect(() => {
    if (lastMessage.includes("END_INTERVIEW_SESSION")) {
      actions.interviewCompleted();
      disconnect();
      saveInterviewRecord({ status: 'COMPLETED', ... });
    }
  }, [messages]);
};
```

#### `useInterviewState.ts` - State Machine

```typescript
type InterviewAction =
  | { type: 'START_INITIALIZING' }
  | { type: 'INITIALIZATION_SUCCESS'; payload: { accessToken, configId } }
  | { type: 'START_CONNECTING'; payload: { questions: string[] } }
  | { type: 'CONNECTION_SUCCESS'; payload: { sessionId } }
  | { type: 'INTERVIEW_STARTED' }
  | { type: 'QUESTION_ASKED'; payload: { questionIndex } }
  | { type: 'QUESTION_ANSWERED' }
  | { type: 'INTERVIEW_COMPLETED' }
  | { type: 'DISCONNECT'; payload: { reason, errorReason? } }
  | { type: 'RESET' };

function interviewReducer(state, action) {
  switch (action.type) {
    case 'QUESTION_ANSWERED':
      return {
        ...state,
        questions: {
          ...state.questions,
          answeredCount: state.questions.answeredCount + 1,
        },
      };
    // ... other cases
  }
}
```

#### `useBeforeUnload.ts` - Tab Close Handler

```typescript
export function useBeforeUnload(dataFn: () => BeforeUnloadData | null) {
  const handleBeforeUnload = useCallback(() => {
    const data = dataFn();
    if (!data) return;

    // Use sendBeacon for reliable delivery
    navigator.sendBeacon('/api/session/record', JSON.stringify({
      ...data,
      status: 'INCOMPLETE',
      disconnectReason: 'tab_closed',
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
```

---

## State Management

### Interview Stages

```typescript
enum InterviewStage {
  IDLE = 'IDLE',                  // Initial state
  INITIALIZING = 'INITIALIZING',  // Getting credentials
  CONNECTING = 'CONNECTING',      // WebSocket connecting
  READY = 'READY',                // Connected, waiting to start
  IN_PROGRESS = 'IN_PROGRESS',    // Interview active
  COMPLETED = 'COMPLETED',        // Successfully finished
  DISCONNECTED = 'DISCONNECTED',  // User ended early
  ERROR = 'ERROR',                // Error occurred
}
```

### Question Tracking

```typescript
interface QuestionState {
  list: string[];         // All questions
  total: number;          // Total count
  currentIndex: number;   // Which question is being asked (-1 = none)
  answeredCount: number;  // How many answered
}
```

### Loading States

```typescript
interface LoadingState {
  isInitializing: boolean;      // Getting credentials
  isConnecting: boolean;        // WebSocket connecting
  isSaving: boolean;            // Saving interview
  isCheckingCapacity: boolean;  // Checking session slots
}
```

---

## Error Handling

### Error Reasons Enum

```typescript
enum ErrorReason {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  MICROPHONE_ERROR = 'MICROPHONE_ERROR',
  USER_ENDED_EARLY = 'USER_ENDED_EARLY',
  TAB_CLOSED = 'TAB_CLOSED',
  CONCURRENT_LIMIT_EXCEEDED = 'CONCURRENT_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}
```

### Error Mapping

```typescript
export const mapVoiceError = (error): MappedError => {
  const errMsg = error?.message?.toLowerCase() || '';

  if (errMsg.includes('permission') || errMsg.includes('denied')) {
    return {
      type: 'Microphone',
      reason: ErrorReason.MICROPHONE_ERROR,
      message: 'Microphone access denied',
      action: 'CheckSettings',
    };
  }

  if (errMsg.includes('socket') || errMsg.includes('network')) {
    return {
      type: 'Network',
      reason: ErrorReason.NETWORK_ERROR,
      message: 'Connection lost',
      action: 'Retry',
    };
  }

  // ... more mappings
};
```

---

## Concurrent Session Management

### How It Works

1. **Capacity Check**: Before connecting, frontend checks `/api/session/capacity`
2. **Session Start**: If allowed, frontend calls `/api/session/start`
3. **Heartbeat**: Every 30s, frontend sends `/api/session/heartbeat`
4. **Session End**: On disconnect, frontend calls `/api/session/end`
5. **Cleanup**: Backend cleans stale sessions every 60s

### Configuration

```bash
# .env
MAX_CONCURRENT_SESSIONS=5      # Max simultaneous interviews
SESSION_STALE_TIMEOUT_MS=300000  # 5 minute timeout
```

---

## Extending the Project

### Adding New Questions

Edit `frontend/src/components/VoiceChat.tsx`:

```typescript
const INTERVIEW_QUESTIONS = [
  "Your new question 1?",
  "Your new question 2?",
  // Add more...
];
```

### Changing the Interview Prompt

Edit `backend/src/server.ts`:

```typescript
const generatePrompt = (): string => {
  return `Your custom prompt here...

Questions List:
{{ questions_list }}

...`;
};
```

### Adding New Error Types

1. Add to `frontend/src/types/interview.ts`:
```typescript
enum ErrorReason {
  // ... existing
  MY_NEW_ERROR = 'MY_NEW_ERROR',
}
```

2. Add mapping in `frontend/src/utils/errorMapper.ts`:
```typescript
if (errMsg.includes('my-condition')) {
  return {
    type: 'System',
    reason: ErrorReason.MY_NEW_ERROR,
    message: 'My error message',
    action: 'Retry',
  };
}
```

### Adding New API Endpoints

1. Add route in `backend/src/server.ts`:
```typescript
app.post('/api/my-endpoint', async (req, res) => {
  // Your logic
});
```

2. Add client function in `frontend/src/api/session.ts`:
```typescript
export const myEndpoint = async (data) => {
  return axios.post(`${BACKEND_URL}/api/my-endpoint`, data);
};
```

### Adding New Interview Stages

1. Add stage to enum:
```typescript
enum InterviewStage {
  // ... existing
  MY_NEW_STAGE = 'MY_NEW_STAGE',
}
```

2. Add action type and reducer case in `useInterviewState.ts`

3. Handle stage in `VoiceChat.tsx` and `App.tsx`

---

## Testing

### TypeScript Validation

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### API Testing

```bash
# Health check
curl http://localhost:3001/health

# Capacity check
curl http://localhost:3001/api/session/capacity

# Session setup
curl -X POST http://localhost:3001/api/session/setup

# Active sessions
curl http://localhost:3001/api/session/active

# Reset database
curl -X POST http://localhost:3001/api/reset
```

---

## Troubleshooting

### "Microphone access denied"
- Check browser permissions
- Ensure HTTPS in production
- Try a different browser (Chrome/Edge recommended)

### "Connection lost"
- Check network connectivity
- Verify backend is running
- Check Hume API status

### "Session limit reached"
- Wait for other sessions to complete
- Increase `MAX_CONCURRENT_SESSIONS` in backend .env
- Check `/api/session/active` for stuck sessions

### "Token expired"
- Refresh the page to get new credentials
- Check Hume API key validity

---

## Additional Resources

- [Hume AI Documentation](https://docs.hume.ai)
- [Hume TypeScript SDK](https://github.com/HumeAI/hume-typescript-sdk)
- [@humeai/voice-react](https://www.npmjs.com/package/@humeai/voice-react)

---
**Last Updated:** 2024
**Status:** Production Ready

