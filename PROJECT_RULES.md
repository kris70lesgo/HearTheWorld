# HearTheWorld Project Rules

These rules are mandatory for the HearTheWorld build.

## Operating Rules

1. Do not make assumptions when there is meaningful uncertainty.
2. If user action is required, stop and wait until that action is complete.
3. Verify each stage before moving to the next stage.
4. Build the minimum reliable demo before adding polish or optional features.
5. Prefer reliability, clarity, demo quality, UX, and narrative over extra APIs.
6. Keep architecture simple and understandable.
7. Do not pretend web apps can reliably monitor microphone audio when closed or fully backgrounded.
8. Do not stack unnecessary AI services.
9. Use the LLM only to turn classified sounds into short accessibility alerts.
10. Prioritize reducing false positives over detecting every possible sound.

## Implementation Rules

1. Frontend uses Next.js App Router, TypeScript, and TailwindCSS.
2. Backend uses FastAPI with WebSocket audio streaming.
3. Browser captures microphone audio using `navigator.mediaDevices.getUserMedia()` and Web Audio APIs.
4. Audio sent to the backend should be 16 kHz mono PCM float32 chunks.
5. Backend should classify buffered audio windows, not tiny raw fragments.
6. Use YAMNet for environmental sound classification.
7. Filter YAMNet output through an important-class allowlist.
8. Apply confidence thresholds before generating alerts.
9. Apply per-sound cooldowns to prevent repeated spam alerts.
10. Map detected sounds into clear priority levels.

## Verification Rules

1. After backend setup, run backend health checks.
2. After WebSocket setup, verify a client can connect.
3. After frontend setup, run lint/build or the closest available project check.
4. After microphone capture is added, verify browser permission and audio capture manually.
5. After classification is added, verify inference with a known local sample or generated test waveform.
6. After frontend-backend integration, verify live WebSocket messages in the browser.
7. After UI work, check desktop and mobile layout.
8. Do not mark a stage complete until it has been verified or an explicit blocker is documented.

## Demo Priorities

1. A clear listening state.
2. A prominent current alert.
3. Confidence and priority shown with text, not color alone.
4. Sound history timeline.
5. Visual waveform feedback.
6. Sensitivity control.
7. Screen flash for critical alerts.
8. Optional browser notifications only after the core loop works.
