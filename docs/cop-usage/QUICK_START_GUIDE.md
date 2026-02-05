# Quick Start: Webhook Signed URLs & Speech-to-Speech

## 30-Minute Setup Guide

### Backend Setup (15 minutes)

#### 1. Install Dependencies
```bash
npm install hume axios node-cache express-rate-limit multer
npm install -D @types/express @types/node ts-node
```

#### 2. Create Signed URL Utility
```bash
# Copy the SignedUrlGenerator from WEBHOOK_SIGNED_URLS_SPEECH_TO_SPEECH.md
# File: src/utils/signedUrl.ts
```

#### 3. Create Webhook Routes
```bash
# Copy webhook routes from the guide
# File: src/routes/webhooks.routes.ts
```

#### 4. Update Main App
```typescript
// src/index.ts
import webhookRoutes from './routes/webhooks.routes';
import speechToSpeechRoutes from './routes/speechToSpeech.routes';

app.use('/api/webhooks', webhookRoutes);
app.use('/api/speech-to-speech', speechToSpeechRoutes);
```

#### 5. Environment Variables
```bash
# .env
WEBHOOK_BASE_URL=https://yourdomain.com/api/webhooks
WEBHOOK_SECRET=your_secure_secret_key_32_chars_minimum
HUME_API_KEY=your_hume_api_key
```

### Frontend Setup (10 minutes)

#### 1. Create Speech-to-Speech Component
```bash
# Copy SpeechToSpeechChat component
# File: src/components/SpeechToSpeechChat.tsx
```

#### 2. Create Page Component
```bash
# Copy SpeechToSpeechPage component
# File: src/pages/SpeechToSpeechPage.tsx
```

#### 3. Update Routes
```typescript
// In your router setup
import SpeechToSpeechPage from './pages/SpeechToSpeechPage';

<Route path="/speech-to-speech" element={<SpeechToSpeechPage />} />
```

#### 4. Update API Base URL
```bash
# .env.local
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

### 5-Minute Testing

#### Local Testing with Ngrok
```bash
# Install ngrok
npm install -g ngrok

# In one terminal - start backend
npm run dev

# In another terminal - start ngrok tunnel
ngrok http 3001

# In .env, update:
WEBHOOK_BASE_URL=https://<your-ngrok-id>.ngrok.io/api/webhooks
```

#### Test Signed URL Generation
```bash
curl -X POST http://localhost:3001/api/webhooks/generate-signed-url \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"eventType": "chat.ended", "expiresIn": 3600}'
```

#### Test Chat Creation
```bash
curl -X POST http://localhost:3001/api/speech-to-speech/create-chat \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"configId": "your-config-id", "enableWebhooks": true}'
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Frontend (React)                       │
│  ┌──────────────────────────────────────────┐  │
│  │ SpeechToSpeechChat Component             │  │
│  │ - Speech Recognition (Web Audio API)     │  │
│  │ - Audio Recording                        │  │
│  │ - Message Display                        │  │
│  └──────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
                 │ HTTP/WebSocket
                 │
┌────────────────▼────────────────────────────────┐
│        Backend (Node.js/Express)                │
│  ┌──────────────────────────────────────────┐  │
│  │ Speech-to-Speech Routes                  │  │
│  │ - /create-chat (initialize with webhook) │  │
│  │ - /send-message (text + audio)           │  │
│  │ - /send-audio (full speech-to-speech)   │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ Webhook Routes                           │  │
│  │ - /generate-signed-url                   │  │
│  │ - /chat-event (verify signature)         │  │
│  └──────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ Hume   │  │Database  │  │ Google   │
│ API    │  │(Chat     │  │ Cloud    │
│        │  │Storage)  │  │ (STT/TTS)│
└────────┘  └──────────┘  └──────────┘
    │            │            │
    └────────────┼────────────┘
                 │
    Webhooks sent back with signed URLs
```

---

## Key Code Snippets

### Generate Signed URL
```typescript
const signedUrl = signedUrlGenerator.generateSignedUrl({
  path: '/api/webhooks/chat-event',
  method: 'POST',
  expiresIn: 86400, // 24 hours
  queryParams: { eventType: 'chat.status', userId }
});
```

### Create Chat with Webhook
```typescript
const chat = await speechService.createSpeechToSpeechChat(
  configId,
  userId,
  { enableWebhooks: true }
);
```

### Send Speech-to-Speech
```typescript
const result = await speechService.processAudioMessage(
  chatId,
  audioBuffer,
  'webm'
);
// Returns: { transcription, message, audioUrl }
```

### Frontend: Start Listening
```typescript
recognitionRef.current?.start();
// Triggers onresult with transcribed text
// Send to backend for processing
```

---

## Database Changes Required

```sql
-- Add webhook columns
ALTER TABLE chats ADD COLUMN webhook_url TEXT;
ALTER TABLE chats ADD COLUMN webhook_started_at TIMESTAMP;
ALTER TABLE chats ADD COLUMN webhook_ended_at TIMESTAMP;

-- Create webhook log table
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100),
  chat_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
```

---

## Common Issues & Fixes

### Issue: "Invalid signature" on webhook
**Solution**: Ensure your webhook secret is at least 32 characters and matches exactly in .env

### Issue: Speech recognition not working
**Solution**: 
- Check browser compatibility (Chrome/Edge recommended)
- Ensure HTTPS for production
- Check microphone permissions

### Issue: Audio playback delayed
**Solution**:
- Reduce audio file size (compression)
- Pre-cache audio when possible
- Implement streaming instead of full file download

### Issue: Webhook not being called
**Solution**:
- Verify webhook URL is publicly accessible
- Check firewall/CORS settings
- Ensure HTTPS certificate is valid
- Verify signed URL hasn't expired

---

## Production Checklist

- [ ] Set secure WEBHOOK_SECRET (32+ chars, random)
- [ ] Configure HTTPS for webhook endpoint
- [ ] Set up webhook retry logic (5 retries, exponential backoff)
- [ ] Implement webhook signature validation on every request
- [ ] Add comprehensive logging for all webhook events
- [ ] Set up monitoring/alerting for webhook failures
- [ ] Test with production-grade load
- [ ] Implement rate limiting (100 req/min)
- [ ] Back up database regularly
- [ ] Document all webhook event types
- [ ] Set up error recovery procedures
- [ ] Test disaster recovery scenarios

---

## Performance Tips

1. **Caching**: Cache config list to reduce API calls
2. **Connection Pooling**: Use database connection pool (min: 5, max: 20)
3. **Async Processing**: Use job queues for heavy operations
4. **CDN**: Store audio files on CDN for faster delivery
5. **Compression**: Compress audio files before transmission

---

## Security Tips

1. **Secrets**: Never log webhook secrets
2. **HTTPS**: Always use HTTPS in production
3. **Validation**: Always verify webhook signatures
4. **Rate Limiting**: Implement per-user rate limits
5. **Timeouts**: Set expiration on signed URLs (default: 1 hour)
6. **Logging**: Log all webhook events for audit trail
7. **Encryption**: Encrypt sensitive data at rest

---

## Next Steps

1. **Implement**: Follow the 30-minute setup above
2. **Test**: Use ngrok for local webhook testing
3. **Deploy**: Deploy to staging first
4. **Monitor**: Set up alerts for webhook failures
5. **Scale**: Add caching and optimize queries as needed

---

## Support Resources

- Full implementation guide: `WEBHOOK_SIGNED_URLS_SPEECH_TO_SPEECH.md`
- Backend guide: `BACKEND_IMPLEMENTATION.md`
- Frontend guide: `FRONTEND_IMPLEMENTATION.md`
- General guide: `HUME_AI_IMPLEMENTATION.md`
- Hume AI Docs: https://docs.hume.ai

