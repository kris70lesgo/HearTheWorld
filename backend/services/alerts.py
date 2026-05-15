from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from time import monotonic

from audio.classifier import Prediction


HIGH_PRIORITY = {
    "Alarm",
    "Explosion",
    "Fire",
    "Fire alarm",
    "Fireworks",
    "Glass breaking",
    "Gunshot, gunfire",
    "Shouting",
    "Siren",
    "Smoke detector",
    "Vehicle horn",
}

MEDIUM_PRIORITY = {
    "Baby cry",
    "Cat",
    "Clap",
    "Crying",
    "Dog",
    "Door",
    "Doorbell",
    "Engine knocking",
    "Engine starting",
    "Footsteps",
    "Impact",
    "Knock",
    "Phone ringing",
    "Screaming",
    "Slap",
    "Snap",
    "Thunderstorm",
    "Train horn",
    "Train whistle",
    "Walk, footsteps",
}

LOW_PRIORITY = {
    "Aircraft",
    "Aircraft engine",
    "Bell",
    "Bicycle bell",
    "Car",
    "Car passing by",
    "Cough",
    "Crying",
    "Engine",
    "Foghorn",
    "Laughter",
    "Microwave oven",
    "Rain",
    "Ringtone",
    "Sliding door",
    "Sneeze",
    "Speech",
    "Toilet flush",
    "Train",
    "Vehicle",
    "Water",
    "Water tap, faucet",
}


@dataclass(frozen=True)
class Alert:
    sound: str
    priority: str
    confidence: float
    message: str
    timestamp: str


class PriorityEngine:
    def get_priority(self, sound: str) -> str:
        if sound in HIGH_PRIORITY:
            return "high"
        if sound in MEDIUM_PRIORITY:
            return "medium"
        if sound in LOW_PRIORITY:
            return "low"
        return "low"


class AlertEngine:
    def __init__(
        self,
        threshold: float = 0.75,
        cooldown_seconds: float = 4.0,
        priority_engine: PriorityEngine | None = None,
    ) -> None:
        self.threshold = threshold
        self.cooldown_seconds = cooldown_seconds
        self.priority_engine = priority_engine or PriorityEngine()
        self._last_alert_by_sound: dict[str, float] = {}
        self._threshold_overrides = {
            "Doorbell": 0.78,
            "Knock": 0.72,
            "Thunderstorm": 0.74,
            "Siren": 0.8,
            "Smoke detector": 0.84,
            "Glass breaking": 0.82,
            "Baby cry": 0.76,
            "Crying": 0.76,
            "Clap": 0.74,
            "Slap": 0.74,
            "Impact": 0.76,
            "Footsteps": 0.78,
        }

    def set_threshold(self, threshold: float) -> None:
        self.threshold = max(0.5, min(0.95, threshold))

    def maybe_create_alert(self, prediction: Prediction) -> Alert | None:
        threshold = max(self.threshold, self._threshold_overrides.get(prediction.sound, 0.0))
        if prediction.confidence < threshold:
            return None

        now = monotonic()
        previous = self._last_alert_by_sound.get(prediction.sound)
        if previous is not None and now - previous < self.cooldown_seconds:
            return None

        self._last_alert_by_sound[prediction.sound] = now
        priority = self.priority_engine.get_priority(prediction.sound)

        return Alert(
            sound=prediction.sound,
            priority=priority,
            confidence=prediction.confidence,
            message=default_alert_message(prediction.sound, priority),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )


def default_alert_message(sound: str, priority: str) -> str:
    if priority == "high":
        return f"Important {sound.lower()} detected nearby."
    if priority == "medium":
        return f"{sound} detected nearby."
    return f"{sound} detected."
