# Hume AI - Frontend Implementation Guide

## Overview
This document provides a comprehensive guide for frontend developers implementing Hume AI features in your React/Vue.js application.

## Table of Contents
1. [Setup & Installation](#setup--installation)
2. [Core Components](#core-components)
3. [Implementation Guide](#implementation-guide)
4. [Real-time Features](#real-time-features)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)
8. [Testing](#testing)

## Setup & Installation

### Prerequisites
- Node.js 16+
- React 18+ or Vue 3+
- TypeScript (recommended)
- Backend API running on accessible URL

### Dependencies
```bash
npm install axios react-query zustand # or your preferred alternatives
npm install recharts # for charts
npm install react-hot-toast # for notifications
npm install --save-dev @types/react @types/react-dom
```

### Environment Configuration
```bash
# .env.local
REACT_APP_API_BASE_URL=http://localhost:3001/api
REACT_APP_HUME_CONFIG_ID=your_config_id
```

---

## Core Components

### 1. Chat UI Component

```typescript
// components/EmpathicVoiceChat.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface EmpathicVoiceChatProps {
  chatId: string;
  onChatEnd?: () => void;
}

const EmpathicVoiceChat: React.FC<EmpathicVoiceChatProps> = ({ chatId, onChatEnd }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/chat/history/${chatId}`
        );
        setMessages(response.data.history || []);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        toast.error('Failed to load chat history');
      }
    };

    if (chatId) {
      loadChatHistory();
    }
  }, [chatId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;

    try {
      setIsSending(true);
      const userMessage: Message = {
        id: Date.now().toString(),
        sender: 'user',
        content: input,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Send to backend API
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/chat/send-message`,
        {
          chatId,
          message: input,
          audioEnabled,
        }
      );

      const assistantMessage: Message = {
        id: Date.now().toString(),
        sender: 'assistant',
        content: response.data.message,
        timestamp: new Date(),
        audioUrl: response.data.audioUrl,
      };

      setMessages(prev => [...prev, assistantMessage]);
      toast.success('Message sent successfully');

      // Play audio response if available
      if (audioEnabled && response.data.audioUrl) {
        playAudio(response.data.audioUrl);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [input, chatId, audioEnabled, isSending]);

  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
      console.error('Failed to play audio:', error);
      toast.error('Failed to play audio');
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endChat = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/chat/end`, {
        chatId,
      });
      toast.success('Chat ended');
      onChatEnd?.();
    } catch (error) {
      console.error('Failed to end chat:', error);
      toast.error('Failed to end chat');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Empathic Voice Chat</h2>
        <button onClick={endChat} className="end-chat-btn">
          End Chat
        </button>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start by typing something!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`message message-${msg.sender}`}>
              <div className="message-content">
                <p>{msg.content}</p>
                {msg.audioUrl && (
                  <audio controls className="message-audio">
                    <source src={msg.audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                )}
              </div>
              <span className="message-timestamp">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-section">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Shift+Enter for new line)"
          disabled={isSending}
          rows={3}
        />
        <div className="controls">
          <button
            onClick={sendMessage}
            disabled={isSending || !input.trim()}
            className="send-btn"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`audio-toggle ${audioEnabled ? 'active' : ''}`}
            title={audioEnabled ? 'Disable audio' : 'Enable audio'}
          >
            🔊 {audioEnabled ? 'Audio On' : 'Audio Off'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmpathicVoiceChat;
```

### 2. Audio Input Component

```typescript
// components/AudioInputComponent.tsx
import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

interface AudioInputComponentProps {
  onAudioRecorded: (blob: Blob) => void;
  maxDuration?: number; // in seconds
}

const AudioInputComponent: React.FC<AudioInputComponentProps> = ({
  onAudioRecorded,
  maxDuration = 60,
}) => {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timer | null>(null);

  const startAudioCapture = useCallback(async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mediaRecorder = new MediaRecorder(mediaStreamRef.current);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        onAudioRecorded(blob);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopAudioCapture();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to access microphone:', error);
      toast.error('Failed to access microphone. Check permissions.');
    }
  }, [maxDuration, onAudioRecorded]);

  const stopAudioCapture = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setRecordingTime(0);
    toast.success('Recording stopped');
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-input">
      <button
        onClick={isRecording ? stopAudioCapture : startAudioCapture}
        className={`record-btn ${isRecording ? 'recording' : ''}`}
      >
        {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
      </button>

      {isRecording && (
        <div className="recording-info">
          <div className="recording-indicator">
            <span className="pulse" />
            Recording...
          </div>
          <span className="recording-time">{formatTime(recordingTime)}</span>
          <div className="time-bar">
            <div
              className="time-fill"
              style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioInputComponent;
```

### 3. Expression Meter Component

```typescript
// components/ExpressionMeter.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ExpressionMetrics {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  neutral: number;
  confidence?: number;
}

interface ExpressionMeterProps {
  metrics: ExpressionMetrics;
  isLoading?: boolean;
}

const ExpressionMeter: React.FC<ExpressionMeterProps> = ({ metrics, isLoading }) => {
  const emotions = Object.entries(metrics)
    .filter(([key]) => key !== 'confidence')
    .map(([emotion, value]) => ({
      name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      value: typeof value === 'number' ? Math.round(value * 100) : 0,
    }));

  const dominant = emotions.reduce((prev, current) =>
    prev.value > current.value ? prev : current
  );

  const chartData = emotions.map(e => ({
    name: e.name,
    value: e.value,
  }));

  if (isLoading) {
    return <div className="expression-meter loading">Loading expression data...</div>;
  }

  return (
    <div className="expression-meter">
      <div className="dominant-emotion">
        <h3>Dominant Emotion</h3>
        <div className="emotion-display">
          <span className="emotion-name">{dominant.name}</span>
          <span className="emotion-value">{dominant.value}%</span>
        </div>
        <div className="emotion-bar">
          <div
            className="fill"
            style={{ width: `${dominant.value}%` }}
          />
        </div>
      </div>

      <div className="all-emotions">
        <h4>All Emotions</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {metrics.confidence && (
        <div className="confidence">
          <label>Confidence Score</label>
          <div className="confidence-bar">
            <div
              className="fill"
              style={{ width: `${Math.round(metrics.confidence * 100)}%` }}
            />
          </div>
          <span>{Math.round(metrics.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
};

export default ExpressionMeter;
```

### 4. Chat Initialization Component

```typescript
// components/ChatInitializer.tsx
import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import EmpathicVoiceChat from './EmpathicVoiceChat';

const ChatInitializer: React.FC = () => {
  const [chatId, setChatId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(
    process.env.REACT_APP_HUME_CONFIG_ID || ''
  );

  const initializeChat = async () => {
    if (!selectedConfig) {
      toast.error('Please select a configuration');
      return;
    }

    try {
      setIsInitializing(true);
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/chat/initialize`,
        { configId: selectedConfig }
      );

      setChatId(response.data.chatId);
      toast.success('Chat initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      toast.error('Failed to initialize chat');
    } finally {
      setIsInitializing(false);
    }
  };

  if (chatId) {
    return (
      <EmpathicVoiceChat
        chatId={chatId}
        onChatEnd={() => {
          setChatId(null);
          toast.success('Chat ended. Ready for new chat.');
        }}
      />
    );
  }

  return (
    <div className="chat-initializer">
      <div className="init-card">
        <h2>Start Empathic Voice Chat</h2>
        <p>Initialize a new chat session to begin</p>

        <div className="config-selector">
          <label>Configuration</label>
          <input
            type="text"
            value={selectedConfig}
            onChange={e => setSelectedConfig(e.target.value)}
            placeholder="Enter config ID or use default"
          />
        </div>

        <button
          onClick={initializeChat}
          disabled={isInitializing}
          className="init-btn"
        >
          {isInitializing ? 'Initializing...' : 'Start Chat'}
        </button>
      </div>
    </div>
  );
};

export default ChatInitializer;
```

---

## Implementation Guide

### Step 1: Setup Component in Page

```typescript
// pages/ChatPage.tsx
import React from 'react';
import ChatInitializer from '../components/ChatInitializer';
import '../styles/chat.css';

const ChatPage: React.FC = () => {
  return (
    <div className="chat-page">
      <div className="chat-wrapper">
        <ChatInitializer />
      </div>
    </div>
  );
};

export default ChatPage;
```

### Step 2: Create Styling

```css
/* styles/chat.css */

.chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  padding: 12px;
  border-radius: 8px;
  max-width: 70%;
  word-wrap: break-word;
}

.message-user {
  align-self: flex-end;
  background: #007bff;
  color: white;
}

.message-assistant {
  align-self: flex-start;
  background: #f0f0f0;
  color: black;
}

.input-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

.controls {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.send-btn {
  background: #007bff;
  color: white;
}

.send-btn:hover:not(:disabled) {
  background: #0056b3;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.audio-toggle {
  background: #28a745;
  color: white;
}

.audio-toggle.active {
  background: #218838;
}

.expression-meter {
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin: 16px 0;
}

.emotion-bar {
  width: 100%;
  height: 24px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.emotion-bar .fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #ffd93d);
  transition: width 0.3s;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.pulse {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #ff4444;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
    transform: scale(1.1);
  }
}
```

---

## Real-time Features

### Polling for Updates

```typescript
// hooks/useChatPolling.ts
import { useEffect, useCallback } from 'react';
import axios from 'axios';

export const useChatPolling = (chatId: string, interval: number = 2000) => {
  useEffect(() => {
    const pollChat = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/chat/history/${chatId}`
        );
        return response.data.history;
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    const timer = setInterval(pollChat, interval);
    return () => clearInterval(timer);
  }, [chatId, interval]);
};
```

### WebSocket Integration (Optional)

```typescript
// hooks/useChatWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';

export const useChatWebSocket = (chatId: string) => {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:3001'}/chat/${chatId}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      wsRef.current?.close();
    };
  }, [chatId]);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { ws: wsRef.current, send };
};
```

---

## State Management

### Using Zustand (Recommended)

```typescript
// store/chatStore.ts
import { create } from 'zustand';

interface ChatStore {
  messages: Message[];
  chatId: string | null;
  isLoading: boolean;
  audioEnabled: boolean;
  addMessage: (message: Message) => void;
  setChatId: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  toggleAudio: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>(set => ({
  messages: [],
  chatId: null,
  isLoading: false,
  audioEnabled: true,
  
  addMessage: (message: Message) =>
    set(state => ({
      messages: [...state.messages, message],
    })),
  
  setChatId: (id: string) => set({ chatId: id }),
  
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  
  toggleAudio: () =>
    set(state => ({
      audioEnabled: !state.audioEnabled,
    })),
  
  clearMessages: () => set({ messages: [] }),
}));
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
// utils/errorHandler.ts
import toast from 'react-hot-toast';

export class ChatError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

export const handleChatError = (error: any) => {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || 'An error occurred';

    switch (status) {
      case 401:
        toast.error('Unauthorized. Please log in again.');
        break;
      case 404:
        toast.error('Chat not found. Please start a new chat.');
        break;
      case 429:
        toast.error('Too many requests. Please wait a moment.');
        break;
      case 500:
        toast.error('Server error. Please try again later.');
        break;
      default:
        toast.error(message);
    }
  } else if (error.request) {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error('An unexpected error occurred.');
  }

  console.error('Chat error:', error);
};
```

---

## Performance Optimization

### Memoization

```typescript
// components/MemoizedMessage.tsx
import React from 'react';

interface MemoizedMessageProps {
  message: Message;
  onPlayAudio?: (url: string) => void;
}

const MemoizedMessage = React.memo<MemoizedMessageProps>(
  ({ message, onPlayAudio }) => (
    <div className={`message message-${message.sender}`}>
      <div className="message-content">
        <p>{message.content}</p>
        {message.audioUrl && (
          <button onClick={() => onPlayAudio?.(message.audioUrl!)}>
            🔊 Play Audio
          </button>
        )}
      </div>
      <span className="message-timestamp">
        {message.timestamp.toLocaleTimeString()}
      </span>
    </div>
  )
);

export default MemoizedMessage;
```

### Lazy Loading

```typescript
// components/ChatInitializer lazy.tsx
import React, { Suspense, lazy } from 'react';

const ChatInitializer = lazy(() => import('./ChatInitializer'));

export const LazyChat = () => (
  <Suspense fallback={<div>Loading chat...</div>}>
    <ChatInitializer />
  </Suspense>
);
```

---

## Testing

### Component Testing with Jest & React Testing Library

```typescript
// __tests__/EmpathicVoiceChat.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmpathicVoiceChat from '../components/EmpathicVoiceChat';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EmpathicVoiceChat', () => {
  it('renders chat component', () => {
    render(<EmpathicVoiceChat chatId="test-id" />);
    expect(screen.getByText(/Empathic Voice Chat/i)).toBeInTheDocument();
  });

  it('sends message on button click', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { message: 'Response', audioUrl: null },
    });

    render(<EmpathicVoiceChat chatId="test-id" />);
    
    const input = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    const button = screen.getByText(/Send/i);
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  it('toggles audio on button click', () => {
    render(<EmpathicVoiceChat chatId="test-id" />);
    
    const audioButton = screen.getByTitle(/Disable audio/i);
    fireEvent.click(audioButton);
    
    expect(audioButton).toHaveClass('active');
  });
});
```

---

## Timeline & Estimates

### Frontend Development (4-6 days)

| Task | Hours | Days |
|------|-------|------|
| Chat UI Components | 20-28 | 2-3 |
| Audio Components | 12-17 | 1-2 |
| Expression Metrics | 10-15 | 1-2 |
| **Total** | **42-60** | **4-6** |

---

## Resources

- [Hume AI Documentation](https://docs.hume.ai)
- [React Documentation](https://react.dev)
- [Recharts Documentation](https://recharts.org)
- [React Query Documentation](https://tanstack.com/query)

**Last Updated:** 2024
**Version:** 1.0
