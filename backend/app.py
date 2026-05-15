import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from audio.buffer import AudioBuffer
from audio.classifier import UnavailableClassifier, filter_predictions
from audio.yamnet import get_classifier
from services.alerts import AlertEngine
from services.hybrid_detector import HybridSoundDetector
from services.lm_studio import LMStudioAlertWriter
from services.transcription import get_transcriber


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


app = FastAPI(title="HearTheWorld API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def send_alert(
    websocket: WebSocket,
    alert_writer: LMStudioAlertWriter,
    *,
    sound: str,
    priority: str,
    confidence: float,
    fallback: str,
) -> None:
    generated_message = await asyncio.to_thread(
        alert_writer.generate,
        sound=sound,
        priority=priority,
        confidence=confidence,
        fallback=fallback,
    )
    await websocket.send_json(
        {
            "type": "alert",
            "alert": {
                "sound": sound,
                "priority": priority,
                "confidence": confidence,
                "message": generated_message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "hear-the-world-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.websocket("/audio")
async def audio_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    audio_buffer = AudioBuffer()
    transcript_buffer = AudioBuffer(window_seconds=2.0, hop_seconds=0.75)
    classifier = UnavailableClassifier()
    hybrid_detector = HybridSoundDetector()
    alert_engine = AlertEngine()
    alert_writer = LMStudioAlertWriter()
    transcriber = None
    last_transcript = ""

    await websocket.send_json(
        {
            "type": "status",
            "status": "connected",
            "message": "Audio WebSocket ready",
        }
    )

    try:
        classifier = get_classifier()
        await websocket.send_json(
            {
                "type": "status",
                "status": "classifier-ready",
                "message": "YAMNet classifier ready",
            }
        )
    except Exception as error:
        await websocket.send_json(
            {
                "type": "status",
                "status": "classifier-unavailable",
                "message": f"YAMNet unavailable: {error}",
            }
        )

    if alert_writer.is_configured:
        await websocket.send_json(
            {
                "type": "status",
                "status": "llm-ready",
                "message": f"LM Studio ready: {alert_writer.model}",
            }
        )
    else:
        await websocket.send_json(
            {
                "type": "status",
                "status": "llm-unavailable",
                "message": "LM Studio unavailable; using local alert text",
            }
        )

    try:
        transcriber = get_transcriber()
        await websocket.send_json(
            {
                "type": "status",
                "status": "transcriber-ready",
                "message": f"Whisper ready: {transcriber.description}",
            }
        )
    except Exception as error:
        await websocket.send_json(
            {
                "type": "status",
                "status": "transcriber-unavailable",
                "message": f"Whisper unavailable: {error}",
            }
        )

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                return

            if "text" in message:
                try:
                    payload = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                if payload.get("type") == "config":
                    threshold = float(payload.get("threshold", alert_engine.threshold))
                    alert_engine.set_threshold(threshold)
                    await websocket.send_json(
                        {
                            "type": "status",
                            "status": "config-updated",
                            "message": f"Threshold set to {alert_engine.threshold:.2f}",
                        }
                    )
                elif payload.get("type") == "test-alert":
                    sound = str(payload.get("sound", "Siren"))
                    priority = str(payload.get("priority", "high"))
                    confidence = float(payload.get("confidence", 0.91))
                    await send_alert(
                        websocket,
                        alert_writer,
                        sound=sound,
                        priority=priority,
                        confidence=confidence,
                        fallback=f"Important {sound.lower()} detected nearby.",
                    )
                continue

            raw_chunk = message.get("bytes")
            if raw_chunk is None:
                continue

            audio_chunk = np.frombuffer(raw_chunk, dtype=np.float32)
            windows = audio_buffer.add_chunk(audio_chunk)
            transcript_windows = transcript_buffer.add_chunk(audio_chunk)

            await websocket.send_json(
                {
                    "type": "debug",
                    "receivedBytes": len(raw_chunk),
                    "samples": int(audio_chunk.size),
                    "bufferedSamples": audio_buffer.buffered_samples,
                    "windowsReady": len(windows),
                }
            )

            if transcriber is not None:
                for transcript_window in transcript_windows[-1:]:
                    transcript = await asyncio.to_thread(
                        transcriber.transcribe,
                        transcript_window,
                    )
                    if transcript and transcript.lower() != last_transcript.lower():
                        last_transcript = transcript
                        await websocket.send_json(
                            {
                                "type": "transcript",
                                "text": transcript,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        )

            for window in windows:
                predictions = filter_predictions(classifier.classify(window))
                if not predictions:
                    continue

                candidates = hybrid_detector.evaluate(predictions, window)
                alert = None
                for candidate in candidates:
                    alert = alert_engine.maybe_create_alert(candidate)
                    if alert is not None:
                        break
                if alert is None:
                    continue

                await send_alert(
                    websocket,
                    alert_writer,
                    sound=alert.sound,
                    priority=alert.priority,
                    confidence=alert.confidence,
                    fallback=alert.message,
                )
    except WebSocketDisconnect:
        return
