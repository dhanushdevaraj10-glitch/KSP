# 🛡️ Sentinel Edge – KSP Crime Intelligence AI

**Sentinel Edge** is an enterprise-grade, intelligent conversational AI and crime database dashboard designed exclusively for the **Karnataka State Police (KSP)**. 

Unlike a standard customer support chatbot, Sentinel Edge acts as a specialized AI Crime Intelligence Assistant capable of FIR analysis, hotspot detection, criminal profiling, and predictive policing. The entire interface and AI interactions are completely localized in **Kannada (ಕನ್ನಡ)**.

![Sentinel Edge UI Overview](./frontend/src/assets/hero.png) *(Note: Replace with actual screenshot)*

## ✨ Key Features

*   **🧠 Localized Kannada AI Engine:** Fully understands and responds to complex crime-related queries in Kannada without relying on expensive external API keys (simulated intelligent engine).
*   **⚡ Streaming Responses:** Chatbot types out responses character-by-character, mimicking a real-time thinking AI.
*   **🔮 Smart Predictions:** Context-aware "Next Question" chips appear automatically based on the ongoing conversation (e.g., asking about "Theft" suggests "Show Hotspots" or "Recommend Patrol Routes").
*   **💾 Persistent Chat History:** All past conversations are saved to local storage, organized by date (Today, Yesterday), and fully searchable.
*   **📎 File Upload & Analysis:** Interface supports uploading files (PDF, CSV, Images) for AI analysis.
*   **🎨 Enterprise UI/UX:** Built with a custom "Dark Navy" theme, glassmorphism elements, minimal modern typography, and a highly responsive dashboard layout.
*   **🎤 Voice Input Integration:** UI includes a toggleable microphone button simulating Kannada voice-to-text dictation.

## 🛠️ Tech Stack Used

This project was built using modern web development tools focused on speed, reliability, and aesthetics:

### **Frontend**
*   **[React 18](https://react.dev/)**: Core UI library.
*   **[Vite](https://vitejs.dev/)**: Ultra-fast frontend build tool.
*   **[TypeScript](https://www.typescriptlang.org/)**: For robust, type-safe code.
*   **[Vanilla CSS & Tailwind-inspired Tokens]**: Custom CSS architecture for the Dark Navy enterprise theme and glassmorphism components.

### **Backend (Optional API Infrastructure)**
*   **[FastAPI (Python)](https://fastapi.tiangolo.com/)**: High-performance API with WebSocket capabilities for real-time chat and a POST endpoint for file parsing.
*   **[Uvicorn](https://www.uvicorn.org/)**: ASGI server for running FastAPI.

### **AI Core**
*   **Custom TypeScript Engine (`aiEngine.ts`)**: A self-contained, pattern-matching AI brain used by the frontend demo without requiring external API keys.
*   **Optional OpenAI backend**: The WebSocket API uses an OpenAI key from `backend/.env` when the backend is started.

## 🚀 How to Run Locally

### 1. Start the Frontend (UI)
```bash
cd frontend
npm install
npm run dev
```
The app will be available at `http://localhost:5173` (or `5174`).

### 2. Start the Backend (Optional - API Infrastructure)
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
The API runs at `http://localhost:8000`.

## 🔒 Security & Privacy
Designed with law enforcement in mind. No external LLM APIs are called by default, ensuring sensitive crime data remains on the local network/device.

---
*Developed for the KSP Datathon / Hackathon*
