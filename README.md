# HearTheWorld

HearTheWorld is a real-time accessibility application that helps users perceive important environmental sounds through visual alerts, live captions, and browser push notifications.

The application listens to microphone audio while the web app is open, detects important sounds such as crying, door knocks, smoke alarms, sirens, glass breaking, thunder, and other high-priority events, and sends accessibility-focused alerts to the user interface and browser notification system.

## Core Features

- Real-time microphone audio capture in the browser
- WebSocket audio streaming from frontend to backend
- Environmental sound classification using YAMNet
- Hybrid targeted detectors for critical sounds
- Live speech transcription using faster-whisper
- Local LLM alert rewriting through LM Studio
- OneSignal browser push notifications for important alerts
- Visual alert dashboard with current alert, history, service status, and live captions
- Background-tab notification support while the app remains open

## Important Sound Alerts

HearTheWorld is configured to send browser push notifications for important or safety-relevant events only:

- Baby cry
- Crying
- Knock
- Doorbell
- Thunderstorm
- Shouting
- Screaming
- Siren
- Alarm
- Fire alarm
- Smoke detector
- Glass breaking
- Gunshot or gunfire
- Explosion
- Vehicle horn
- Impact

Lower-priority sounds such as normal speech, rain, pets, water, or general background activity are shown in the app but are not pushed by default.

## System Architecture

```txt
Browser microphone
  -> Next.js frontend
  -> Web Audio API PCM chunks
  -> FastAPI WebSocket backend
  -> audio buffering and windowing
  -> YAMNet classification
  -> targeted hybrid detectors
  -> priority and cooldown engine
  -> LM Studio alert writer
  -> frontend dashboard and OneSignal push notification
```

## Technology Stack

### Frontend

- Next.js App Router
- TypeScript
- TailwindCSS
- Web Audio API
- OneSignal Web Push

### Backend

- FastAPI
- WebSockets
- NumPy
- TensorFlow Hub YAMNet
- faster-whisper
- LM Studio OpenAI-compatible local API

## Project Structure

```txt
HearTheWorld/
  frontend/
    src/app/
    src/components/
    src/hooks/
    src/lib/
    public/
      OneSignalSDKWorker.js
      OneSignalSDKUpdaterWorker.js

  backend/
    app.py
    audio/
    services/
```

## Local Development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

Use `localhost` for notification testing because browser notification permissions are origin-specific.

## Environment Variables

### Backend

Create `.env` in the project root:

```bash
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=gemma-4-e4b-it-mlx
WHISPER_MODEL_SIZE=base.en
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=1
```

### Frontend

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_ONESIGNAL_APP_ID=67b7ec41-d3ba-46c5-8587-a16eb62317ef
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
NEXT_PUBLIC_AUDIO_WS_URL=ws://127.0.0.1:8000/audio
```

For deployment over HTTPS, `NEXT_PUBLIC_AUDIO_WS_URL` must use `wss://`.

## OneSignal Web Push

The OneSignal service workers are served from:

```txt
/OneSignalSDKWorker.js
/OneSignalSDKUpdaterWorker.js
```

Browser push notifications require:

- notification permission granted by the user
- service workers available at the site root
- HTTPS in production
- correct OneSignal App ID and REST API key
- browser or OS notifications enabled

## Browser Behavior

HearTheWorld can keep listening while the app tab remains open and the user switches to another tab. Browser push notifications can appear while the browser is minimized or in the background.

The app does not provide guaranteed always-on microphone monitoring after the tab is closed. A desktop or native application would be required for reliable closed-app background listening.

## Deployment Notes

Recommended deployment split:

- Frontend: Vercel
- Backend: Railway, Render, Fly.io, or another service that supports long-running WebSockets and Python ML dependencies

The backend must expose a public WebSocket endpoint:

```txt
wss://your-backend-domain/audio
```

The backend CORS configuration must include the deployed frontend domain.

## Demo Flow

1. Open the dashboard.
2. Start listening.
3. Allow microphone and notification permissions.
4. Trigger a test alert.
5. Switch to another tab.
6. Play or produce an important sound such as baby crying, knocking, siren, smoke alarm, or thunder.
7. Show the visual alert, history entry, caption area, and native browser notification.

## Limitations

- Accuracy depends on microphone quality, room noise, and model confidence.
- Music lyric transcription has a short delay because Whisper needs audio context.
- Browser background microphone capture works only while the page remains open.
- OneSignal delivery depends on browser and operating system notification settings.
