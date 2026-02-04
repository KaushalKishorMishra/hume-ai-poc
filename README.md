# Hume AI Speech-to-Speech PoC

A production-ready Proof of Concept for Hume's Empathic Voice Interface (EVI).
This architecture uses a **Secure Backend Proxy** to protect your API keys.

## 📁 Architecture

1.  **Backend (`/backend`):** Node.js/Express. Authenticaties with Hume and provides short-lived Access Tokens.
2.  **Frontend (`/frontend`):** React + Vite + Hume SDK. Handles microphone streams and WebSocket connections.

## 🚀 Getting Started

### 1. Prerequisites
*   Hume AI Account & API Key.
*   **Config ID:** Create an EVI Config in the [Hume Portal](https://portal.hume.ai).

### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file
echo "HUME_API_KEY=your_key_here" >> .env
echo "HUME_SECRET_KEY=your_secret_here" >> .env
echo "PORT=3001" >> .env
echo "FRONTEND_URL=http://localhost:5173" >> .env

# Run Proxy
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create .env file
echo "VITE_HUME_CONFIG_ID=your_evi_config_id" >> .env

# Run Client
npm run dev
```

## 🛡️ Error Handling & Features
This PoC includes robust handling for:
*   **Live Transcripts:** Real-time text visualization of the speech-to-speech conversation.
*   **Microphone Denied:** User is guided to settings.
*   **Network Drop:** WebSocket disconnects are caught.
*   **Quota Limits:** Backend maps 429 errors to UI alerts.
*   **Token Expiry:** Auto-refresh logic (via the App wrapper).

## 🔒 Security
*   **Secret Key:** Never leaves the backend.
*   **Access Token:** Short-lived (60 min), safe for browser usage.
