# HearTheWorld

HearTheWorld is a real-time accessibility sound awareness demo. It listens through the browser microphone while the app tab is active, detects important environmental sounds, generates accessible alerts, transcribes nearby speech, and sends browser push notifications through OneSignal.

## Stack

- Frontend: Next.js, TypeScript, TailwindCSS
- Backend: FastAPI, WebSocket audio streaming
- Sound detection: YAMNet plus targeted hybrid detectors
- Speech transcription: faster-whisper
- Alert writing: local LM Studio model
- Notifications: OneSignal Web Push

## Project Structure

```txt
frontend/  Next.js application and OneSignal web push integration
backend/   FastAPI audio pipeline, YAMNet, hybrid detectors, Whisper captions
```

## Local Setup

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create local env files as needed. Do not commit secrets.

Root `.env` is used by the backend for LM Studio configuration.

Frontend `.env.local` is used for OneSignal:

```bash
NEXT_PUBLIC_ONESIGNAL_APP_ID=67b7ec41-d3ba-46c5-8587-a16eb62317ef
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

## Notes

Web microphone listening works while the page stays open, including when the user switches to another tab. Browser push notifications can appear while the browser is in the background after permission is granted. Fully closed-tab or always-on background listening requires a desktop or native app.
