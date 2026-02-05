# Hume AI: Webhook Signed URLs & Speech-to-Speech Implementation Guide

## Overview
This guide covers implementing secure webhooks with signed URLs and speech-to-speech capabilities in Hume AI. This is essential for production environments where you need:
- Secure webhook verification using signed URLs
- Real-time speech-to-speech conversation
- Webhook event handling for chat completions and status updates

## Table of Contents
1. [Signed URLs for Webhooks](#signed-urls-for-webhooks)
2. [Speech-to-Speech Implementation](#speech-to-speech-implementation)
3. [Frontend Integration](#frontend-integration)
4. [Backend Implementation](#backend-implementation)
5. [Security Best Practices](#security-best-practices)
6. [Testing & Deployment](#testing--deployment)

---

## Signed URLs for Webhooks

### 1. Understanding Signed URLs

A signed URL is a URL that contains a cryptographic signature proving:
- The URL hasn't been tampered with
- The request came from a trusted source
- The URL is only valid for a specific time period

### 2. Backend: Generating Signed URLs

```typescript
// src/utils/signedUrl.ts
import crypto from 'crypto';
import { URL } from 'url';
import config from '../config/env';

export interface SignedUrlOptions {
  expiresIn?: number; // seconds (default: 3600)
  method?: string; // HTTP method
  path: string;
  queryParams?: Record<string, any>;
}

export class SignedUrlGenerator {
  private secret: string;
  private baseUrl: string;

  constructor(secret: string = config.WEBHOOK_SECRET, baseUrl: string = config.WEBHOOK_BASE_URL) {
    this.secret = secret;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a signed webhook URL for Hume AI
   */
  generateSignedUrl(options: SignedUrlOptions): string {
    const { expiresIn = 3600, method = 'POST', path, queryParams = {} } = options;

    // Create timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + expiresIn;

    // Build query parameters
    const params = {
      ...queryParams,
      timestamp,
      expiresAt,
    };

    // Create canonical string for signing
    const canonical = this.createCanonicalString(method, path, params);

    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(canonical)
      .digest('hex');

    // Add signature to params
    params.signature = signature;

    // Build URL
    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    return url.toString();
  }

  /**
   * Verify a signed URL
   */
  verifySignedUrl(signedUrl: string): {
    valid: boolean;
    expired: boolean;
    data?: Record<string, any>;
  } {
    try {
      const url = new URL(signedUrl);
      const params = Object.fromEntries(url.searchParams);

      // Extract signature
      const signature = params.signature as string;
      delete params.signature;

      // Get expiration
      const expiresAt = parseInt(params.expiresAt as string, 10);
      const now = Math.floor(Date.now() / 1000);

      // Check expiration
      if (now > expiresAt) {
        return { valid: false, expired: true };
      }

      // Recreate canonical string
      const method = 'POST'; // Webhooks are typically POST
      const path = url.pathname;
      const canonical = this.createCanonicalString(method, path, params);

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
    } catch (error) {
      return { valid: false, expired: false };
    }
  }

  /**
   * Create canonical string for HMAC signing
   */
  private createCanonicalString(
    method: string,
    path: string,
    params: Record<string, any>
  ): string {
    // Sort parameters for consistent hashing
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    return `${method}\n${path}\n${sortedParams}`;
  }
}

export default new SignedUrlGenerator();
```

### 3. Environment Configuration

```bash
# .env
# Webhook Configuration
WEBHOOK_BASE_URL=https://yourdomain.com/api/webhooks
WEBHOOK_SECRET=your_secure_secret_key_min_32_chars
HUME_WEBHOOK_EVENT_TYPES=chat.started,chat.ended,chat.message

# For local development with ngrok:
# WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io/api/webhooks
```

### 4. Backend: Webhook Routes

```typescript
// src/routes/webhooks.routes.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import signedUrlGenerator from '../utils/signedUrl';
import logger from '../utils/logger';
import { query } from '../config/database';

const router: Router = express.Router();

/**
 * Middleware to verify signed webhook URLs
 */
const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const verification = signedUrlGenerator.verifySignedUrl(fullUrl);

    if (!verification.valid) {
      if (verification.expired) {
        logger.warn('Webhook URL expired:', fullUrl);
        return res.status(401).json({ error: 'Webhook URL expired' });
      }
      logger.warn('Invalid webhook signature:', fullUrl);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Attach verified data to request
    (req as any).webhookData = verification.data;
    next();
  } catch (error) {
    logger.error('Webhook verification error:', error);
    res.status(500).json({ error: 'Webhook verification failed' });
  }
};

/**
 * Endpoint to generate signed webhook URLs for Hume AI
 * Call this before creating a chat with webhook config
 */
router.post('/generate-signed-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventType = 'chat.ended', expiresIn = 3600 } = req.body;

    const signedUrl = signedUrlGenerator.generateSignedUrl({
      path: '/api/webhooks/chat-event',
      method: 'POST',
      expiresIn,
      queryParams: {
        eventType,
        userId: req.user?.id,
      },
    });

    res.json({
      signedUrl,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      eventType,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Webhook endpoint that receives events from Hume AI
 * This URL must be signed and verified
 */
router.post('/chat-event', verifyWebhookSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookEvent = req.body;
    const webhookData = (req as any).webhookData;

    logger.info('Webhook received:', {
      eventType: webhookData.eventType,
      chatId: webhookEvent.chat_id,
    });

    // Handle different event types
    switch (webhookData.eventType) {
      case 'chat.started':
        await handleChatStarted(webhookEvent);
        break;
      case 'chat.ended':
        await handleChatEnded(webhookEvent);
        break;
      case 'chat.message':
        await handleChatMessage(webhookEvent);
        break;
      case 'chat.error':
        await handleChatError(webhookEvent);
        break;
      default:
        logger.warn('Unknown webhook event type:', webhookData.eventType);
    }

    // Always return 200 OK to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    // Still return 200 to prevent Hume from retrying
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

/**
 * Handle chat started event
 */
async function handleChatStarted(event: any) {
  try {
    const { chat_id, timestamp } = event;

    await query(
      `UPDATE chats SET webhook_started_at = $1 WHERE chat_id = $2`,
      [new Date(timestamp), chat_id]
    );

    logger.info(`Chat started: ${chat_id}`);
  } catch (error) {
    logger.error('Error handling chat started event:', error);
  }
}

/**
 * Handle chat ended event
 */
async function handleChatEnded(event: any) {
  try {
    const { chat_id, timestamp, duration, message_count } = event;

    await query(
      `UPDATE chats 
       SET webhook_ended_at = $1, 
           duration = $2, 
           message_count = $3, 
           status = 'completed'
       WHERE chat_id = $4`,
      [new Date(timestamp), duration, message_count, chat_id]
    );

    logger.info(`Chat ended: ${chat_id} (Duration: ${duration}ms, Messages: ${message_count})`);
  } catch (error) {
    logger.error('Error handling chat ended event:', error);
  }
}

/**
 * Handle chat message event
 */
async function handleChatMessage(event: any) {
  try {
    const { chat_id, message, role, timestamp } = event;

    await query(
      `INSERT INTO interactions (chat_id, role, message, created_at)
       VALUES ($1, $2, $3, $4)`,
      [chat_id, role, message, new Date(timestamp)]
    );

    logger.info(`Message recorded for chat: ${chat_id}`);
  } catch (error) {
    logger.error('Error handling chat message event:', error);
  }
}

/**
 * Handle chat error event
 */
async function handleChatError(event: any) {
  try {
    const { chat_id, error, timestamp } = event;

    await query(
      `INSERT INTO chat_errors (chat_id, error_message, created_at)
       VALUES ($1, $2, $3)`,
      [chat_id, JSON.stringify(error), new Date(timestamp)]
    );

    logger.error(`Chat error: ${chat_id}`, error);
  } catch (error) {
    logger.error('Error handling chat error event:', error);
  }
}

export default router;
```

### 5. Database Schema for Webhooks

```sql
-- Add webhook columns to chats table
ALTER TABLE chats ADD COLUMN webhook_started_at TIMESTAMP;
ALTER TABLE chats ADD COLUMN webhook_ended_at TIMESTAMP;
ALTER TABLE chats ADD COLUMN duration INTEGER;
ALTER TABLE chats ADD COLUMN message_count INTEGER;

-- Create table for chat errors from webhooks
CREATE TABLE chat_errors (
  id SERIAL PRIMARY KEY,
  chat_id UUID NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

-- Create table for webhook logs
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100),
  chat_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chat_errors_chat_id ON chat_errors(chat_id);
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
```

---

## Speech-to-Speech Implementation

### 1. Frontend: Speech-to-Speech Component

```typescript
// src/components/SpeechToSpeechChat.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface SpeechToSpeechChatProps {
  chatId: string;
  configId: string;
}

const SpeechToSpeechChat: React.FC<SpeechToSpeechChatProps> = ({ chatId, configId }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; sender: 'user' | 'assistant' }>>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        toast.success('Listening...');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        toast.error(`Speech recognition error: ${event.error}`);
      };

      recognitionRef.current.onresult = async (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          await handleUserSpeech(finalTranscript.trim());
        }
      };
    }
  }, []);

  /**
   * Handle user speech input and send to backend
   */
  const handleUserSpeech = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    try {
      setIsProcessing(true);

      // Add user message to UI
      setMessages(prev => [...prev, { text: transcript, sender: 'user' }]);

      // Send to backend for processing
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/chat/send-message`,
        {
          chatId,
          message: transcript,
          audioEnabled: true, // For speech-to-speech
          speechToSpeech: true,
        }
      );

      if (response.data.message) {
        // Add assistant message to UI
        setMessages(prev => [...prev, { text: response.data.message, sender: 'assistant' }]);

        // Play audio response if available
        if (response.data.audioUrl) {
          await playAudio(response.data.audioUrl);
        }
      }
    } catch (error) {
      toast.error('Failed to process speech');
      console.error('Error processing speech:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [chatId]);

  /**
   * Start listening for user speech
   */
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  }, [isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  /**
   * Play audio response
   */
  const playAudio = useCallback(async (audioUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        const audio = audioRef.current;
        audio.src = audioUrl;
        audio.onended = () => {
          setIsSpeaking(false);
          resolve();
        };
        audio.onerror = () => {
          toast.error('Failed to play audio');
          reject(new Error('Audio playback failed'));
        };

        setIsSpeaking(true);
        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  /**
   * Handle microphone recording with fallback
   */
  const startMicrophoneRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorder.start();
      setIsListening(true);
      toast.success('Recording audio...');
    } catch (error) {
      toast.error('Unable to access microphone');
      console.error('Microphone error:', error);
    }
  }, []);

  /**
   * Stop microphone recording
   */
  const stopMicrophoneRecording = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsListening(false);
    }
  }, [isListening]);

  /**
   * Send audio blob to backend for processing
   */
  const sendAudioToBackend = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('speechToSpeech', 'true');

      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/chat/send-audio`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      if (response.data.audioUrl) {
        await playAudio(response.data.audioUrl);
      }
    } catch (error) {
      toast.error('Failed to send audio');
      console.error('Error sending audio:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [chatId, playAudio]);

  return (
    <div className="speech-to-speech-chat">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>

      <div className="controls">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing || isSpeaking}
          className={`control-btn ${isListening ? 'listening' : ''}`}
        >
          {isListening ? '🔴 Stop' : '🎤 Listen'}
        </button>

        <button
          onClick={isSpeaking ? undefined : startMicrophoneRecording}
          disabled={isProcessing || isSpeaking}
          className="control-btn"
        >
          🎙️ Microphone
        </button>

        <div className="status">
          {isProcessing && <span>Processing...</span>}
          {isSpeaking && <span>🔊 Speaking...</span>}
          {isListening && <span>👂 Listening...</span>}
        </div>
      </div>

      <audio ref={audioRef} />
    </div>
  );
};

export default SpeechToSpeechChat;
```

### 2. Backend: Speech-to-Speech Chat Service

```typescript
// src/services/speechToSpeechService.ts
import Hume from 'hume';
import { query } from '../config/database';
import logger from '../utils/logger';
import signedUrlGenerator from '../utils/signedUrl';
import axios from 'axios';

export interface SpeechToSpeechConfig {
  configId: string;
  enableWebhooks?: boolean;
  webhookEventTypes?: string[];
}

export class SpeechToSpeechService {
  private humeClient: Hume;

  constructor(humeClient: Hume) {
    this.humeClient = humeClient;
  }

  /**
   * Create a chat session with speech-to-speech and webhooks
   */
  async createSpeechToSpeechChat(
    configId: string,
    userId: string,
    options: SpeechToSpeechConfig = {}
  ) {
    try {
      const { enableWebhooks = true, webhookEventTypes = ['chat.ended', 'chat.started'] } = options;

      logger.info(`Creating speech-to-speech chat for user ${userId}`);

      // Generate signed webhook URLs if webhooks enabled
      let webhookUrl: string | undefined;
      if (enableWebhooks) {
        webhookUrl = signedUrlGenerator.generateSignedUrl({
          path: '/api/webhooks/chat-event',
          method: 'POST',
          expiresIn: 86400, // 24 hours
          queryParams: {
            eventType: 'chat.status',
            userId,
          },
        });
      }

      // Create chat with Hume API
      const chatConfig: any = {
        configId,
        ...(webhookUrl && {
          webhook: {
            url: webhookUrl,
            events: webhookEventTypes,
          },
        }),
      };

      const chat = await this.humeClient.empathicVoice.chat.create(chatConfig);

      // Store in database
      const result = await query(
        `INSERT INTO chats (chat_id, user_id, config_id, status, created_at, webhook_url)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         RETURNING *`,
        [chat.id, userId, configId, 'active', webhookUrl]
      );

      logger.info(`Speech-to-speech chat created: ${chat.id}`);

      return {
        chatId: chat.id,
        userId,
        configId,
        webhookUrl,
        status: 'active',
      };
    } catch (error) {
      logger.error('Failed to create speech-to-speech chat:', error);
      throw new Error('Failed to create chat');
    }
  }

  /**
   * Send text message and get audio response
   */
  async sendMessageWithAudio(chatId: string, message: string): Promise<{
    message: string;
    audioUrl: string;
    metadata: any;
  }> {
    try {
      logger.info(`Sending message to chat ${chatId}`);

      const response = await this.humeClient.empathicVoice.chat.sendMessage({
        chatId,
        message,
      });

      // Generate audio from response
      const audioUrl = await this.generateAudioFromText(response.message);

      // Store interaction
      await query(
        `INSERT INTO interactions (chat_id, user_message, assistant_message, audio_url, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chatId, message, response.message, audioUrl]
      );

      return {
        message: response.message,
        audioUrl,
        metadata: response.metadata || {},
      };
    } catch (error) {
      logger.error('Failed to send message with audio:', error);
      throw error;
    }
  }

  /**
   * Process audio file and return audio response
   */
  async processAudioMessage(
    chatId: string,
    audioBuffer: Buffer,
    audioFormat: string = 'webm'
  ): Promise<{
    transcription: string;
    message: string;
    audioUrl: string;
  }> {
    try {
      logger.info(`Processing audio message for chat ${chatId}`);

      // Step 1: Transcribe audio to text (Speech-to-Text)
      const transcription = await this.transcribeAudio(audioBuffer);
      logger.info(`Transcribed: "${transcription}"`);

      // Step 2: Send transcription to Hume for response
      const response = await this.humeClient.empathicVoice.chat.sendMessage({
        chatId,
        message: transcription,
      });

      // Step 3: Generate audio from response (Text-to-Speech)
      const audioUrl = await this.generateAudioFromText(response.message);

      // Store interaction
      await query(
        `INSERT INTO interactions (chat_id, user_message, assistant_message, audio_url, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chatId, transcription, response.message, audioUrl]
      );

      return {
        transcription,
        message: response.message,
        audioUrl,
      };
    } catch (error) {
      logger.error('Failed to process audio message:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio to text using Web Speech API or external service
   */
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Option 1: Use Google Cloud Speech-to-Text
      const response = await axios.post(
        'https://speech.googleapis.com/v1p1beta1/speech:recognize',
        {
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
          },
          audio: {
            content: audioBuffer.toString('base64'),
          },
        },
        {
          params: {
            key: process.env.GOOGLE_CLOUD_API_KEY,
          },
        }
      );

      const transcript =
        response.data.results?.[0]?.alternatives?.[0]?.transcript || '';
      return transcript;
    } catch (error) {
      logger.error('Speech-to-text transcription error:', error);
      // Fallback to empty transcription
      return '';
    }
  }

  /**
   * Generate audio from text using Text-to-Speech
   */
  private async generateAudioFromText(text: string): Promise<string> {
    try {
      // Option 1: Use Google Cloud Text-to-Speech
      const response = await axios.post(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        {
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-C',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: 0,
            speakingRate: 1,
          },
        },
        {
          params: {
            key: process.env.GOOGLE_CLOUD_API_KEY,
          },
        }
      );

      const audioContent = response.data.audioContent;
      // Save to storage or return data URL
      const dataUrl = `data:audio/mp3;base64,${audioContent}`;
      return dataUrl;
    } catch (error) {
      logger.error('Text-to-speech generation error:', error);
      throw error;
    }
  }

  /**
   * Get real-time emotion metrics during speech
   */
  async getEmotionDuringChat(chatId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT emotion_data FROM chats WHERE chat_id = $1`,
        [chatId]
      );

      if (result.rows.length === 0) {
        throw new Error('Chat not found');
      }

      return result.rows[0].emotion_data;
    } catch (error) {
      logger.error('Failed to get emotion data:', error);
      throw error;
    }
  }
}

export default SpeechToSpeechService;
```

### 3. Backend: Speech-to-Speech Routes

```typescript
// src/routes/speechToSpeech.routes.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import SpeechToSpeechService from '../services/speechToSpeechService';
import { getHumeClient } from '../config/hume';
import logger from '../utils/logger';

const router: Router = express.Router();
const speechService = new SpeechToSpeechService(getHumeClient());

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Create speech-to-speech chat with webhooks
 */
router.post('/create-chat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { configId, enableWebhooks = true } = req.body;
    const userId = req.user?.id;

    if (!configId || !userId) {
      return res.status(400).json({ error: 'Missing configId or userId' });
    }

    const chat = await speechService.createSpeechToSpeechChat(
      configId,
      userId,
      { enableWebhooks }
    );

    res.status(201).json(chat);
  } catch (error) {
    next(error);
  }
});

/**
 * Send text message and get audio response
 */
router.post('/send-message', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'Missing chatId or message' });
    }

    const result = await speechService.sendMessageWithAudio(chatId, message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Send audio file and get audio response (full speech-to-speech)
 */
router.post(
  '/send-audio',
  authenticate,
  upload.single('audio'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chatId } = req.body;
      const audioFile = req.file;

      if (!chatId || !audioFile) {
        return res.status(400).json({ error: 'Missing chatId or audio file' });
      }

      const result = await speechService.processAudioMessage(
        chatId,
        audioFile.buffer,
        audioFile.mimetype
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get emotion data during chat
 */
router.get('/emotion/:chatId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chatId } = req.params;

    const emotionData = await speechService.getEmotionDuringChat(chatId);
    res.json({ emotionData });
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## Frontend Integration

### Complete Speech-to-Speech Chat Page

```typescript
// src/pages/SpeechToSpeechPage.tsx
import React, { useState, useEffect } from 'react';
import SpeechToSpeechChat from '../components/SpeechToSpeechChat';
import axios from 'axios';
import toast from 'react-hot-toast';

const SpeechToSpeechPage: React.FC = () => {
  const [chatId, setChatId] = useState<string | null>(null);
  const [configId, setConfigId] = useState(process.env.REACT_APP_HUME_CONFIG_ID || '');
  const [isInitializing, setIsInitializing] = useState(false);
  const [configs, setConfigs] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    // Fetch available configs
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/configs/list`
      );
      setConfigs(response.data.configs);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    }
  };

  const initializeChat = async () => {
    if (!configId) {
      toast.error('Please select a configuration');
      return;
    }

    try {
      setIsInitializing(true);
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/speech-to-speech/create-chat`,
        { configId, enableWebhooks: true }
      );

      setChatId(response.data.chatId);
      toast.success('Speech-to-speech chat initialized');
    } catch (error) {
      toast.error('Failed to initialize chat');
      console.error('Initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  if (chatId) {
    return (
      <div className="speech-to-speech-page">
        <SpeechToSpeechChat chatId={chatId} configId={configId} />
        <button
          onClick={() => setChatId(null)}
          className="end-chat-btn"
        >
          End Chat
        </button>
      </div>
    );
  }

  return (
    <div className="initialization-page">
      <h1>Speech-to-Speech Chat</h1>
      <div className="config-selector">
        <label>Select Configuration:</label>
        <select
          value={configId}
          onChange={(e) => setConfigId(e.target.value)}
        >
          <option value="">Choose a config...</option>
          {configs.map(cfg => (
            <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={initializeChat}
        disabled={isInitializing || !configId}
        className="init-btn"
      >
        {isInitializing ? 'Initializing...' : 'Start Chat'}
      </button>
    </div>
  );
};

export default SpeechToSpeechPage;
```

---

## Security Best Practices

### 1. Webhook Security Checklist

```typescript
// src/utils/webhookSecurity.ts

export const webhookSecurityChecklist = {
  /**
   * 1. Validate signature on every webhook request
   */
  validateSignature: true,

  /**
   * 2. Check timestamp to prevent replay attacks
   */
  checkTimestamp: {
    enabled: true,
    tolerance: 300, // 5 minutes in seconds
  },

  /**
   * 3. Use HTTPS only for webhook URLs
   */
  enforceHttps: true,

  /**
   * 4. Rotate webhook secrets regularly
   */
  secretRotation: {
    enabled: true,
    rotationIntervalDays: 90,
  },

  /**
   * 5. Log all webhook requests for audit
   */
  logWebhooks: true,

  /**
   * 6. Implement rate limiting on webhooks
   */
  rateLimit: {
    enabled: true,
    maxRequestsPerMinute: 100,
  },

  /**
   * 7. Verify webhook content integrity
   */
  contentValidation: true,

  /**
   * 8. Use UUIDs for all identifiers
   */
  useUUIDs: true,

  /**
   * 9. Never expose secrets in logs
   */
  maskSecrets: true,

  /**
   * 10. Implement webhook retries with exponential backoff
   */
  retryPolicy: {
    enabled: true,
    maxRetries: 5,
    backoffMultiplier: 2,
  },
};

/**
 * Webhook signature validation middleware
 */
export const validateWebhookIntegrity = (payload: any, signature: string, secret: string): boolean => {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Check if webhook timestamp is valid
 */
export const isWebhookTimestampValid = (timestamp: number, tolerance: number = 300): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= tolerance;
};
```

### 2. Environment Security

```bash
# .env.production
# Webhook Configuration
WEBHOOK_BASE_URL=https://yourdomain.com/api/webhooks
WEBHOOK_SECRET=<generate-with-32-chars-min>
NODE_ENV=production

# Google Cloud (for Speech-to-Text and Text-to-Speech)
GOOGLE_CLOUD_API_KEY=<your-key>

# Database
DATABASE_URL=<secure-connection-string>

# JWT
JWT_SECRET=<secure-secret>

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Testing & Deployment

### 1. Testing Webhooks Locally

```typescript
// src/__tests__/webhooks.test.ts
import request from 'supertest';
import app from '../index';
import signedUrlGenerator from '../utils/signedUrl';
import { query } from '../config/database';

jest.mock('../config/database');

describe('Webhook Endpoints', () => {
  describe('POST /api/webhooks/generate-signed-url', () => {
    it('should generate a valid signed URL', async () => {
      const response = await request(app)
        .post('/api/webhooks/generate-signed-url')
        .set('Authorization', 'Bearer test-token')
        .send({ eventType: 'chat.ended', expiresIn: 3600 });

      expect(response.status).toBe(200);
      expect(response.body.signedUrl).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
    });

    it('should include signature in URL', async () => {
      const response = await request(app)
        .post('/api/webhooks/generate-signed-url')
        .set('Authorization', 'Bearer test-token')
        .send({ eventType: 'chat.ended' });

      const url = new URL(response.body.signedUrl);
      expect(url.searchParams.get('signature')).toBeDefined();
    });
  });

  describe('POST /api/webhooks/chat-event', () => {
    it('should reject invalid signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/chat-event?signature=invalid')
        .send({ chat_id: 'test-chat', event: 'test' });

      expect(response.status).toBe(401);
    });

    it('should accept valid webhook event', async () => {
      const signedUrl = signedUrlGenerator.generateSignedUrl({
        path: '/api/webhooks/chat-event',
        queryParams: { eventType: 'chat.ended' },
      });

      const url = new URL(signedUrl);
      const response = await request(app)
        .post(`/api/webhooks/chat-event${url.search}`)
        .send({
          chat_id: 'test-chat-id',
          timestamp: new Date().toISOString(),
          duration: 60000,
          message_count: 5,
        });

      expect(response.status).toBe(200);
    });
  });
});
```

### 2. Using Ngrok for Local Testing

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3001

# Update .env with ngrok URL
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io/api/webhooks

# Start your backend
npm run dev
```

### 3. Deployment Checklist

```typescript
// deployment-checklist.ts
const deploymentChecklist = {
  security: {
    '✓ Validate all webhook signatures': false,
    '✓ Use HTTPS for all endpoints': false,
    '✓ Rotate secrets': false,
    '✓ Mask sensitive data in logs': false,
    '✓ Implement rate limiting': false,
  },

  infrastructure: {
    '✓ Database backups configured': false,
    '✓ Monitoring and alerts set up': false,
    '✓ Error logging configured': false,
    '✓ Performance monitoring enabled': false,
    '✓ Auto-scaling configured': false,
  },

  testing: {
    '✓ Unit tests passing': false,
    '✓ Integration tests passing': false,
    '✓ Webhook signature tests passing': false,
    '✓ Load testing completed': false,
    '✓ Security audit completed': false,
  },

  documentation: {
    '✓ API documentation updated': false,
    '✓ Webhook payload documented': false,
    '✓ Emergency procedures documented': false,
    '✓ Runbook created': false,
  },
};
```

---

## Summary

### Key Points:

1. **Signed URLs**: Cryptographically verify webhook authenticity
2. **Webhooks**: Real-time event notifications from Hume AI
3. **Speech-to-Speech**: Full audio input/output conversations
4. **Security**: HMAC-SHA256 signatures, timestamp validation, HTTPS enforcement

### Implementation Order:

1. Set up signed URL generation utility
2. Implement webhook verification middleware
3. Create chat endpoints with webhook support
4. Add speech recognition on frontend
5. Implement text-to-speech for responses
6. Test with ngrok locally
7. Deploy to production with security hardening

### Production Considerations:

- Use environment-specific secrets
- Implement comprehensive logging
- Set up monitoring and alerting
- Plan for webhook retries
- Document webhook payload structure
- Implement circuit breakers for external services
- Use connection pooling for databases

