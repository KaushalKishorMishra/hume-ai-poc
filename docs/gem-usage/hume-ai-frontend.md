# Hume AI Frontend Implementation Guide (Browser/React/Vue)

This guide is tailored for frontend developers to implement Hume AI features securely, specifically avoiding API key exposure.

## 1. Authentication (Critical)

**Security Rule:** **NEVER** use `apiKey` or `secretKey` in frontend code.

### The Authentication Pattern
1.  **Fetch Token:** Request a short-lived `accessToken` from your backend.
2.  **Initialize:** Use this token to authenticate the Hume Client or WebSocket connection.

```typescript
import { HumeClient } from "hume";

async function initializeHume() {
    // 1. Call your backend endpoint (see Backend Guide)
    const authResponse = await fetch("/api/hume/auth");
    const { accessToken } = await authResponse.json();

    if (!accessToken) {
        throw new Error("Failed to get access token");
    }

    // 2. Initialize the client securely
    const client = new HumeClient({
        accessToken: accessToken,
    });

    return client;
}
```

---

## 2. Empathic Voice Interface (EVI)

Real-time voice conversation. This requires managing WebSocket state and audio.

### Implementation Steps

```typescript
import { HumeClient } from "hume";

async function startVoiceChat(accessToken: string) {
    const hume = new HumeClient({ accessToken });
    
    // 1. Connect the socket
    const socket = hume.empathicVoice.chat.connect({
        onOpen: () => console.log("Socket connected"),
        onClose: () => console.log("Socket closed"),
        onError: (err) => console.error("Socket error", err),
    });

    // 2. Handle Incoming Messages
    socket.on("message", (message) => {
        switch (message.type) {
            case "audio_output":
                // Handle audio playback (base64 encoded PCM/MP3)
                playAudio(message.data); 
                break;
            case "user_message":
                console.log("You:", message.message.content);
                break;
            case "assistant_message":
                console.log("AI:", message.message.content);
                break;
        }
    });

    // 3. Wait for connection
    await socket.tillSocketOpen();

    // 4. Send Input (Text or Audio)
    socket.sendUserInput("Hello! How are you?");
}

// Helper: Audio Playback (Simplified)
function playAudio(base64Data: string) {
    const audioContent = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    // Use Web Audio API (AudioContext) to decode and play 'audioContent'
    // Note: Actual implementation requires a robust audio queue system.
}
```

---

## 3. Streaming Expression Measurement (WebSockets)

Real-time analysis of text or audio from the browser.

```typescript
async function streamAnalysis(accessToken: string) {
    const hume = new HumeClient({ accessToken });

    const socket = hume.expressionMeasurement.stream.connect({
        config: { language: {} } // Enable language/sentiment analysis
    });

    await socket.sendText({ text: "I'm really excited about this!" });
    
    socket.on("message", (data) => {
        // 'data' contains emotion scores
        console.log("Emotion Data:", data); 
    });
}
```

---

## 4. Time Estimates & User Experience

### Engineering Effort (Frontend)

| Task | Estimated Time | Complexity |
| :--- | :--- | :--- |
| **Auth Integration** | **1 - 2 hours** | Low. Fetching token and initializing client. |
| **EVI Integration** | **6 - 12 hours** | High. Requires robust AudioContext management (recording & playback queues) to prevent choppy audio. |
| **UI/UX Implementation** | **4 - 8 hours** | Medium. Visualizers (waveforms), chat bubbles, connection states. |
| **Testing** | **2 - 4 hours** | Medium. Validating socket reconnection and audio permission handling. |
| **Total Frontend Effort** | **~2 - 3 Days** | |

### UX / Latency Expectations

| Feature | Latency | User Experience Note |
| :--- | :--- | :--- |
| **Voice Response (EVI)** | **500ms - 1.5s** | Feels conversational. Use "Listening..." or "Thinking..." states in UI. |
| **Streaming Results** | **< 200ms** | Very snappy. Great for real-time emotion graphs. |
| **Connection Start** | **~500ms** | Initial WebSocket handshake. Show a loader. |

## 5. Frontend Best Practices

- **Audio Context:** browsers require a user interaction (click) to resume/start `AudioContext`. Handle this in your "Start Chat" button.
- **Microphone Permissions:** Gracefully handle cases where the user denies microphone access.
- **Clean Up:** Always call `socket.close()` when the component unmounts to prevent memory leaks.
- **Reconnection:** Implement logic to reconnect if the WebSocket drops due to network issues.
