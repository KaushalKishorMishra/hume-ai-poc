# Hume AI: Complete Code Examples

## Table of Contents
1. [Webhook Signed URL Examples](#webhook-signed-url-examples)
2. [Speech-to-Speech Examples](#speech-to-speech-examples)
3. [Frontend Integration Examples](#frontend-integration-examples)
4. [Backend Service Examples](#backend-service-examples)
5. [Database Setup Examples](#database-setup-examples)
6. [Testing Examples](#testing-examples)

---

## Webhook Signed URL Examples

### Example 1: Generate a Signed Webhook URL

```typescript
import signedUrlGenerator from './utils/signedUrl';

// Generate a signed URL for webhook events
const signedUrl = signedUrlGenerator.generateSignedUrl({
  path: '/api/webhooks/chat-event',
  method: 'POST',
  expiresIn: 3600, // 1 hour
  queryParams: {
    eventType: 'chat.ended',
    userId: 'user-123',
    chatId: 'chat-456'
  }
});

console.log('Signed URL:', signedUrl);
// Output: https://yourdomain.com/api/webhooks/chat-event?timestamp=1234567890&expiresAt=1234571490&signature=abc123...&eventType=chat.ended&userId=user-123&chatId=chat-456
```

### Example 2: Verify Webhook Signature

```typescript
// In your webhook receiver
const verification = signedUrlGenerator.verifySignedUrl(fullUrl);

if (!verification.valid) {
  if (verification.expired) {
    console.log('Webhook URL has expired');
    return res.status(401).json({ error: 'URL expired' });
  }
  console.log('Invalid webhook signature');
  return res.status(401).json({ error: 'Invalid signature' });
}

console.log('Webhook verified! Data:', verification.data);
// Output: { eventType: 'chat.ended', userId: 'user-123', ... }
```

### Example 3: Create Chat with Webhook

```typescript
// Create a chat session that will send webhook events
const signedWebhookUrl = signedUrlGenerator.generateSignedUrl({
  path: '/api/webhooks/chat-event',
  expiresIn: 86400, // 24 hours
  queryParams: { eventType: 'chat.status' }
});

const chat = await humeClient.empathicVoice.chat.create({
  configId: 'your-config-id',
  webhook: {
    url: signedWebhookUrl,
    events: ['chat.started', 'chat.ended', 'chat.message']
  }
});

console.log('Chat created with webhooks:', chat.id);
```

### Example 4: Handle Webhook Events

```typescript
// Handle different webhook event types
async function handleWebhookEvent(event: any, eventType: string) {
  switch (eventType) {
    case 'chat.started':
      console.log('Chat started:', event.chat_id);
      await db.query(
        'UPDATE chats SET webhook_started_at = NOW() WHERE chat_id = $1',
        [event.chat_id]
      );
      break;

    case 'chat.ended':
      console.log('Chat ended:', event.chat_id);
      console.log('Duration:', event.duration, 'ms');
      console.log('Messages:', event.message_count);
      
      await db.query(
        `UPDATE chats SET 
           webhook_ended_at = NOW(), 
           duration = $1, 
           message_count = $2 
         WHERE chat_id = $3`,
        [event.duration, event.message_count, event.chat_id]
      );
      break;

    case 'chat.message':
      console.log('Message:', event.message);
      console.log('Role:', event.role);
      
      await db.query(
        `INSERT INTO interactions (chat_id, role, message, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [event.chat_id, event.role, event.message]
      );
      break;

    case 'chat.error':
      console.error('Chat error:', event.error);
      
      await db.query(
        `INSERT INTO chat_errors (chat_id, error_message, created_at)
         VALUES ($1, $2, NOW())`,
        [event.chat_id, JSON.stringify(event.error)]
      );
      break;
  }
}
```

---

## Speech-to-Speech Examples

### Example 1: Basic Speech-to-Speech Chat

```typescript
// Frontend: Start speech-to-speech conversation
async function startSpeechToSpeechChat() {
  // 1. Initialize chat with speech-to-speech enabled
  const response = await fetch('/api/speech-to-speech/create-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      configId: 'your-config-id',
      enableWebhooks: true
    })
  });

  const { chatId } = await response.json();
  console.log('Chat created:', chatId);

  // 2. Start listening for user speech
  startSpeechRecognition(chatId);

  // 3. When user speaks, process it
  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    console.log('User said:', transcript);

    // 4. Send to backend for processing
    const result = await fetch('/api/speech-to-speech/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: transcript
      })
    });

    const { audioUrl } = await result.json();

    // 5. Play audio response
    const audio = new Audio(audioUrl);
    audio.play();
  };
}
```

### Example 2: Full Audio Input/Output

```typescript
// Frontend: Full speech-to-speech with audio input
async function recordAndProcess(chatId: string) {
  // 1. Record audio from microphone
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });

    // 2. Send audio to backend
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('audio', audioBlob);

    const response = await fetch('/api/speech-to-speech/send-audio', {
      method: 'POST',
      body: formData
    });

    const { transcription, message, audioUrl } = await response.json();

    console.log('Transcription:', transcription);
    console.log('Response:', message);

    // 3. Play response audio
    const audio = new Audio(audioUrl);
    audio.play();
  };

  // Start recording
  recorder.start();
  console.log('Recording...');

  // Stop after 10 seconds or when user stops
  setTimeout(() => recorder.stop(), 10000);
}
```

### Example 3: Backend Processing Audio

```typescript
// Backend: Process audio and return audio response
async function processAudioMessage(
  chatId: string,
  audioBuffer: Buffer
): Promise<{ transcription: string; audioUrl: string }> {
  // 1. Transcribe audio (Speech-to-Text)
  const transcription = await transcribeAudio(audioBuffer);
  console.log('Transcribed:', transcription);

  // 2. Send to Hume for response
  const response = await humeClient.empathicVoice.chat.sendMessage({
    chatId,
    message: transcription
  });

  // 3. Generate audio from response (Text-to-Speech)
  const audioUrl = await generateAudio(response.message);

  // 4. Store interaction
  await db.query(
    `INSERT INTO interactions (chat_id, user_message, assistant_message, audio_url)
     VALUES ($1, $2, $3, $4)`,
    [chatId, transcription, response.message, audioUrl]
  );

  return { transcription, audioUrl };
}

// Speech-to-Text using Google Cloud
async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const response = await axios.post(
    'https://speech.googleapis.com/v1p1beta1/speech:recognize',
    {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true
      },
      audio: {
        content: audioBuffer.toString('base64')
      }
    },
    {
      params: { key: process.env.GOOGLE_CLOUD_API_KEY }
    }
  );

  return response.data.results?.[0]?.alternatives?.[0]?.transcript || '';
}

// Text-to-Speech using Google Cloud
async function generateAudio(text: string): Promise<string> {
  const response = await axios.post(
    'https://texttospeech.googleapis.com/v1/text:synthesize',
    {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-C',
        ssmlGender: 'FEMALE'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: 0,
        speakingRate: 1
      }
    },
    {
      params: { key: process.env.GOOGLE_CLOUD_API_KEY }
    }
  );

  return `data:audio/mp3;base64,${response.data.audioContent}`;
}
```

---

## Frontend Integration Examples

### Example 1: React Hook for Speech-to-Speech

```typescript
// hooks/useSpeechToSpeech.ts
import { useState, useRef, useCallback } from 'react';

export const useSpeechToSpeech = (chatId: string) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                            (window as any).webkitSpeechRecognition;
    
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = async (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        
        if (transcript) {
          await sendMessage(transcript);
        }
      };
    }

    recognitionRef.current.start();
  }, [chatId]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/speech-to-speech/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      });
      const data = await response.json();
      
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        await audio.play();
      }
    } finally {
      setIsProcessing(false);
    }
  }, [chatId]);

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening
  };
};
```

### Example 2: Speech-to-Speech Component

```typescript
// components/SpeechToSpeechUI.tsx
import React from 'react';
import { useSpeechToSpeech } from '../hooks/useSpeechToSpeech';

export const SpeechToSpeechUI: React.FC<{ chatId: string }> = ({ chatId }) => {
  const { isListening, isProcessing, startListening, stopListening } = 
    useSpeechToSpeech(chatId);

  return (
    <div className="speech-controls">
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        className={`speech-btn ${isListening ? 'listening' : ''}`}
      >
        {isListening ? '🔴 Stop' : '🎤 Listen'}
      </button>
      
      {isProcessing && <span className="processing">Processing...</span>}
      {isListening && <span className="listening">Listening...</span>}
    </div>
  );
};
```

---

## Backend Service Examples

### Example 1: Complete Chat Service

```typescript
// services/chatService.ts
import Hume from 'hume';
import { query } from '../config/database';
import signedUrlGenerator from '../utils/signedUrl';

export class ChatService {
  constructor(private humeClient: Hume) {}

  async createChatWithWebhook(configId: string, userId: string) {
    // Generate signed webhook URL
    const webhookUrl = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      expiresIn: 86400, // 24 hours
      queryParams: { eventType: 'chat.status' }
    });

    // Create chat via Hume
    const chat = await this.humeClient.empathicVoice.chat.create({
      configId,
      webhook: {
        url: webhookUrl,
        events: ['chat.started', 'chat.ended']
      }
    });

    // Store in database
    await query(
      `INSERT INTO chats (chat_id, user_id, config_id, status, webhook_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [chat.id, userId, configId, 'active', webhookUrl]
    );

    return { chatId: chat.id, webhookUrl };
  }

  async sendMessageWithAudio(chatId: string, message: string) {
    const response = await this.humeClient.empathicVoice.chat.sendMessage({
      chatId,
      message
    });

    // Generate audio from response
    const audioUrl = await this.generateAudio(response.message);

    return { message: response.message, audioUrl };
  }

  private async generateAudio(text: string): Promise<string> {
    // TTS implementation
    return `data:audio/mp3;base64,${Buffer.from(text).toString('base64')}`;
  }
}
```

### Example 2: Webhook Handler Service

```typescript
// services/webhookService.ts
export class WebhookService {
  async handleWebhookEvent(eventType: string, payload: any) {
    switch (eventType) {
      case 'chat.started':
        return this.handleChatStarted(payload);
      case 'chat.ended':
        return this.handleChatEnded(payload);
      case 'chat.message':
        return this.handleChatMessage(payload);
    }
  }

  private async handleChatStarted(payload: any) {
    console.log('Chat started:', payload.chat_id);
    // Update database
    // Send notifications
    // Log analytics
  }

  private async handleChatEnded(payload: any) {
    console.log('Chat ended:', payload.chat_id);
    console.log('Duration:', payload.duration);
    console.log('Messages:', payload.message_count);
    // Calculate metrics
    // Send summary notification
    // Archive chat
  }

  private async handleChatMessage(payload: any) {
    console.log('Message from', payload.role, ':', payload.message);
    // Store message
    // Update chat state
    // Check for keywords
  }
}
```

---

## Database Setup Examples

### Example 1: Complete Schema

```sql
-- Create chats table with webhook support
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  chat_id UUID UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  config_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  webhook_url TEXT,
  webhook_started_at TIMESTAMP,
  webhook_ended_at TIMESTAMP,
  duration INTEGER,
  message_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create interactions table
CREATE TABLE interactions (
  id SERIAL PRIMARY KEY,
  chat_id UUID NOT NULL,
  role VARCHAR(20), -- 'user' or 'assistant'
  message TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

-- Create webhook logs
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100),
  chat_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_interactions_chat_id ON interactions(chat_id);
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
```

---

## Testing Examples

### Example 1: Test Signed URL Generation

```typescript
// __tests__/signedUrl.test.ts
import signedUrlGenerator from '../utils/signedUrl';

describe('SignedUrlGenerator', () => {
  it('should generate a valid signed URL', () => {
    const url = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      queryParams: { eventType: 'chat.ended' }
    });

    expect(url).toContain('signature=');
    expect(url).toContain('timestamp=');
    expect(url).toContain('expiresAt=');
  });

  it('should verify a valid signed URL', () => {
    const url = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      expiresIn: 3600
    });

    const verification = signedUrlGenerator.verifySignedUrl(url);
    expect(verification.valid).toBe(true);
    expect(verification.expired).toBe(false);
  });

  it('should reject invalid signatures', () => {
    const url = 'http://localhost:3001/api/webhooks/chat-event?signature=invalid&timestamp=123&expiresAt=456';
    
    const verification = signedUrlGenerator.verifySignedUrl(url);
    expect(verification.valid).toBe(false);
  });

  it('should detect expired URLs', () => {
    const url = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      expiresIn: -100 // Already expired
    });

    const verification = signedUrlGenerator.verifySignedUrl(url);
    expect(verification.expired).toBe(true);
  });
});
```

### Example 2: Test Webhook Handler

```typescript
// __tests__/webhook.test.ts
import request from 'supertest';
import app from '../index';
import signedUrlGenerator from '../utils/signedUrl';

describe('Webhook Endpoints', () => {
  it('should accept valid webhook events', async () => {
    const signedUrl = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      queryParams: { eventType: 'chat.ended' }
    });

    const url = new URL(signedUrl);

    const response = await request(app)
      .post(`/api/webhooks/chat-event${url.search}`)
      .send({
        chat_id: 'test-chat-123',
        timestamp: new Date().toISOString(),
        duration: 60000,
        message_count: 5
      });

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it('should reject requests with invalid signatures', async () => {
    const response = await request(app)
      .post('/api/webhooks/chat-event?signature=invalid')
      .send({ chat_id: 'test-chat' });

    expect(response.status).toBe(401);
  });
});
```

### Example 3: Test Speech-to-Speech Service

```typescript
// __tests__/speechToSpeech.test.ts
import { SpeechToSpeechService } from '../services/speechToSpeechService';

describe('SpeechToSpeechService', () => {
  let service: SpeechToSpeechService;

  beforeEach(() => {
    service = new SpeechToSpeechService(mockHumeClient);
  });

  it('should create chat with webhook', async () => {
    const result = await service.createSpeechToSpeechChat(
      'config-123',
      'user-456',
      { enableWebhooks: true }
    );

    expect(result.chatId).toBeDefined();
    expect(result.webhookUrl).toBeDefined();
    expect(result.webhookUrl).toContain('signature=');
  });

  it('should process audio message', async () => {
    const audioBuffer = Buffer.from('test audio data');
    
    const result = await service.processAudioMessage(
      'chat-123',
      audioBuffer,
      'webm'
    );

    expect(result.transcription).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.audioUrl).toBeDefined();
  });
});
```

---

## Complete Integration Example

### Full Workflow

```typescript
// Example: Complete speech-to-speech workflow

// 1. Frontend initiates chat
const { data: chatData } = await axios.post(
  '/api/speech-to-speech/create-chat',
  { configId: 'config-123', enableWebhooks: true }
);
const chatId = chatData.chatId;

// 2. User speaks
const transcript = 'What is the weather?';

// 3. Send to backend
const { data: response } = await axios.post(
  '/api/speech-to-speech/send-message',
  { chatId, message: transcript }
);

// 4. Backend receives request
// - Sends to Hume AI via API
// - Hume returns response text
// - Backend generates audio using TTS
// - Response stored in database

// 5. Frontend receives audio URL
// - Play audio response
const audio = new Audio(response.audioUrl);
audio.play();

// 6. Webhook event triggered
// - Hume sends webhook to /api/webhooks/chat-event
// - Signature is verified
// - Event is logged
// - Database is updated

// 7. Chat analytics available
const chatStats = await axios.get(`/api/chat/stats/${chatId}`);
console.log('Chat duration:', chatStats.duration);
console.log('Message count:', chatStats.messageCount);
```

