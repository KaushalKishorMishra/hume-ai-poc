# Hume AI Backend Implementation Guide (Node.js)

This guide is tailored for backend engineers to implement Hume AI services securely and efficiently using the TypeScript SDK.

## 1. Installation & Initialization

Install the SDK:

```bash
npm install hume
```

### Secure Initialization
On the backend, you can safely load your API keys from environment variables.

```typescript
import { HumeClient } from "hume";

// Ensure these are set in your .env file
const hume = new HumeClient({
    apiKey: process.env.HUME_API_KEY,
    secretKey: process.env.HUME_SECRET_KEY,
});
```

---

## 2. Authentication Endpoint (Critical)

**Goal:** Provide a secure way for your frontend to authenticate without exposing your API Key.
**Task:** Create an API route (e.g., `GET /api/hume/auth`) that returns a short-lived access token.

```typescript
import { fetchAccessToken } from "hume";

// Example Route Handler (Express/Next.js/etc.)
export async function handleAuthRequest(req, res) {
    try {
        const accessToken = await fetchAccessToken({
            apiKey: process.env.HUME_API_KEY,
            secretKey: process.env.HUME_SECRET_KEY,
        });

        // Return the token to the client
        res.status(200).json({ accessToken });
    } catch (error) {
        console.error("Failed to fetch access token:", error);
        res.status(500).json({ error: "Authentication failed" });
    }
}
```

---

## 3. Feature Implementation (Server-Side)

### A. Batch Inference (Expression Measurement)
Best for processing pre-recorded files (video/audio).

```typescript
async function processVideo(videoUrl: string) {
    console.log(`Starting job for: ${videoUrl}`);

    // 1. Start the job
    const job = await hume.expressionMeasurement.batch.startInferenceJob({
        models: { 
            face: {}, 
            prosody: {} 
        },
        urls: [videoUrl],
    });

    // 2. Await completion (or use a webhook for async handling)
    await job.awaitCompletion();

    // 3. Retrieve results
    const predictions = await hume.expressionMeasurement.batch.getJobPredictions(job.jobId);
    return predictions;
}
```

### B. Text-to-Speech (TTS)
Generate audio on the server to cache or stream to clients.

```typescript
async function generateSpeech(text: string) {
    const response = await hume.tts.synthesizeJson({
        utterances: [{
            text: text,
            description: "A professional, neutral narrator."
        }],
        format: { type: "mp3" }
    });
    
    // response.generations[0].audio contains base64 encoded audio
    return response.generations[0].audio;
}
```

---

## 4. Time Estimates & Performance

### Engineering Effort (Backend)

| Task | Estimated Time | Notes |
| :--- | :--- | :--- |
| **Auth Endpoint Setup** | **1 - 2 hours** | Includes env var setup and error handling. |
| **Batch Job Integration** | **2 - 4 hours** | Handling job status polling or webhooks. |
| **TTS Service Wrapper** | **1 - 2 hours** | Creating a reusable service/function. |
| **Testing & Robustness** | **2 - 3 hours** | Integration tests, retry logic configuration. |
| **Total Backend Effort** | **~1 - 1.5 Days** | |

### System Latency (What to expect)

| Operation | Typical Latency |
| :--- | :--- |
| **Auth Token Fetch** | **~100 - 300ms** | Quick API call to Hume Auth service. |
| **Batch Processing** | **Variable** | ~30-50% of the media file's duration. |
| **TTS Generation** | **< 1s** | Fast generation for standard text. |

## 5. Best Practices

- **Webhooks vs Polling:** For long batch jobs, prefer setting up a webhook receiver instead of keeping a connection open with `awaitCompletion()`.
- **Caching:** Cache TTS results for common phrases to save costs and reduce latency.
- **Error Handling:** Wrap Hume calls in try/catch blocks and handle `HumeError` specifically to log status codes for debugging.
