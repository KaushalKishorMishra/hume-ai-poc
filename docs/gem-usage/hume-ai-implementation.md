# Hume AI Implementation Guide

This guide provides a comprehensive overview of how to implement Hume AI using the TypeScript SDK, covering both frontend and backend architectures, along with time estimates for planning.

## Architecture & Authentication

Security is paramount. Your implementation strategy depends on your environment.

### 1. Backend Implementation (Node.js)
**Safe Environment:** You can directly use your API Key and Secret Key.

```typescript
import { HumeClient } from "hume";

const hume = new HumeClient({
    apiKey: process.env.HUME_API_KEY,
    secretKey: process.env.HUME_SECRET_KEY,
});
```

### 2. Frontend Implementation (Browser / React / Vue)
**Unsafe Environment:** **NEVER** expose your API Key or Secret Key in client-side code.

**The Pattern:**
1.  **Backend:** Create an endpoint (e.g., `/api/hume/auth`) that uses your credentials to fetch a short-lived `accessToken`.
2.  **Frontend:** Call this endpoint to get the token, then initialize `HumeClient`.

**Step A: Backend Utility (to fetch token)**
```typescript
import { fetchAccessToken } from "hume";

// In your backend route handler
async function getClientToken() {
    const accessToken = await fetchAccessToken({
        apiKey: process.env.HUME_API_KEY,
        secretKey: process.env.HUME_SECRET_KEY,
    });
    return accessToken;
}
```

**Step B: Frontend Usage**
```typescript
import { HumeClient } from "hume";

async function initHume() {
    // 1. Fetch token from your backend
    const response = await fetch("/api/hume/auth");
    const { accessToken } = await response.json();

    // 2. Initialize client with the token
    const hume = new HumeClient({
        accessToken: accessToken,
    });
    
    return hume;
}
```

---

## Feature Implementation

### 1. Expression Measurement
Analyze expressions in media (face, prosody, language, etc.).

**Batch Inference (Backend recommended)**
Good for processing large files asynchronously.
```typescript
const job = await hume.expressionMeasurement.batch.startInferenceJob({
    models: { face: {}, prosody: {} },
    urls: ["https://example.com/video.mp4"],
});
await job.awaitCompletion();
const predictions = await hume.expressionMeasurement.batch.getJobPredictions(job.jobId);
```

**Streaming Inference (Frontend/Backend)**
Real-time analysis via WebSockets.
```typescript
const socket = hume.expressionMeasurement.stream.connect({
    config: { language: {} },
});
await socket.sendText({ text: "I am feeling very happy today!" });
```

### 2. Empathic Voice Interface (EVI)
Real-time, voice-to-voice conversation with an AI.

```typescript
// Frontend example (after auth)
const socket = hume.empathicVoice.chat.connect();

socket.on("message", (message) => {
    if (message.type === "audio_output") {
        const audioBuffer = Buffer.from(message.data, "base64");
        // Play audioBuffer using Web Audio API
    }
});

await socket.tillSocketOpen();
socket.sendUserInput("Hello!");
```

### 3. Text-to-Speech (TTS)
Generate expressive speech.

```typescript
const response = await hume.tts.synthesizeJson({
    utterances: [{
        text: "Hello world.",
        description: "A calm, soothing voice."
    }],
    format: { type: "mp3" }
});
// Use response.generations[0].audio
```

---

## Time Estimates

### Development Time (Engineering Effort)
*Estimates for a senior developer familiar with TypeScript.*

| Feature | Scope | Estimated Time |
| :--- | :--- | :--- |
| **Project Setup & Auth** | Backend route, Environment variables, Frontend fetch logic | **2 - 4 hours** |
| **Expression Measurement** | Batch processing integration, file handling, polling logic | **3 - 6 hours** |
| **EVI (Voice Interface)** | WebSocket state management, Audio recording/playback (Frontend) | **6 - 12 hours** |
| **TTS Integration** | API calls, Audio playback integration | **2 - 4 hours** |
| **Testing & Polish** | Error handling, retries, unit/integration tests | **4 - 8 hours** |
| **Total MVP** | **~2 - 4 Days** |

### AI System Latency (Runtime Performance)
*Time used by the AI/Cloud system to process requests.*

| Operation | Latency / Processing Time | Notes |
| :--- | :--- | :--- |
| **EVI (Voice-to-Voice)** | **500ms - 1.5s** | End-to-end latency (Voice Activity Detection -> LLM -> TTS -> Audio Output). Highly optimized. |
| **Streaming Inference** | **< 200ms** | Near real-time per chunk of data sent over WebSocket. |
| **TTS Generation** | **< 1s** | For standard sentence lengths (streaming starts almost instantly). |
| **Batch Processing** | **Variable** | Depends heavily on media length. Roughly 0.2x - 0.5x realtime (e.g., 10min video takes ~2-5min). |

## Error Handling & Best Practices

- **Timeout Configuration:** Default is 60s. Increase `timeoutInSeconds` for large batch jobs.
- **Retries:** The SDK automatically handles retries for 409, 429, and 5xx errors.
- **Audio Handling:** For EVI on the frontend, use robust libraries (like `AudioContext` or helper hooks) to handle sample rate conversion and buffer management to minimize latency.
