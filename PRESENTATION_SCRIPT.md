# HearTheWorld Presentation Script

## 30-Second Version

HearTheWorld is a real-time accessibility app for people who may miss important sounds around them.

It listens through the browser microphone, detects sounds like a baby crying, a knock at the door, sirens, smoke alarms, glass breaking, thunder, and other urgent events, then turns them into clear visual alerts and browser notifications.

The key idea is simple: important sounds become visible, readable, and actionable.

## 2-Minute Demo Script

This is HearTheWorld.

The problem we are solving is that important sounds are easy to miss if someone is deaf, hard of hearing, wearing headphones, sleeping, or in a noisy environment.

HearTheWorld runs in the browser. When I press Start, the app asks for microphone permission and begins listening to the environment in real time.

The audio is streamed to a FastAPI backend over WebSocket. On the backend, we use YAMNet for general environmental sound classification, then a hybrid detection layer improves important sounds like knocking, doorbells, smoke alarms, glass breaking, claps, impacts, crying, and thunder.

When the backend detects an important sound, the dashboard updates immediately with the current alert, confidence, priority, and sound history.

The app also has live speech captions using Whisper, so if someone nearby is speaking, the user can see what was said.

For notifications, we integrated OneSignal Web Push. That means if the app is still open and I switch to another tab, important alerts can still appear as native browser notifications.

We do not notify for every sound. We only push important events, such as baby crying, knocking, doorbell, siren, smoke detector, glass breaking, thunderstorm, shouting, explosion, gunshot, vehicle horn, or a strong impact.

This keeps the app useful without spamming the user.

The demo shows three things:

1. real-time sound detection
2. accessible visual alerts and captions
3. browser notifications when the user is not looking at the app

The goal is not to build a research-grade audio lab. The goal is a reliable accessibility assistant that makes nearby sound events visible and understandable.

## Feature Checklist To Show

- Start listening
- Microphone permission
- Notification permission
- Current alert card
- Sound history
- Live captions
- Service status
- OneSignal push status
- Test alert
- Switch tabs and show browser notification

## Important Sounds To Mention

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

## One-Line Closing

HearTheWorld turns important sounds into visual alerts, captions, and notifications so users can understand what is happening around them without relying on hearing alone.
