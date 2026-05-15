from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np


IMPORTANT_CLASSES = {
    "Aircraft",
    "Aircraft engine",
    "Air horn, truck horn",
    "Alarm",
    "Alarm clock",
    "Ambulance (siren)",
    "Baby cry, infant cry",
    "Bell",
    "Bicycle bell",
    "Bang",
    "Breaking",
    "Bouncing",
    "Basketball bounce",
    "Car",
    "Car alarm",
    "Car passing by",
    "Cat",
    "Caterwaul",
    "Children shouting",
    "Civil defense siren",
    "Clapping",
    "Cough",
    "Crying, sobbing",
    "Dog",
    "Door",
    "Doorbell",
    "Emergency vehicle",
    "Engine",
    "Engine knocking",
    "Engine starting",
    "Explosion",
    "Fire",
    "Fire alarm",
    "Fire engine, fire truck (siren)",
    "Firecracker",
    "Fireworks",
    "Finger snapping",
    "Foghorn",
    "Glass",
    "Gunshot, gunfire",
    "Hands",
    "Knock",
    "Laughter",
    "Microwave oven",
    "Police car (siren)",
    "Rain",
    "Rain on surface",
    "Raindrop",
    "Ringtone",
    "Run",
    "Screaming",
    "Shout",
    "Siren",
    "Slap, smack",
    "Sliding door",
    "Smoke detector, smoke alarm",
    "Sneeze",
    "Speech",
    "Telephone",
    "Telephone bell ringing",
    "Thump, thud",
    "Thunder",
    "Thunderstorm",
    "Toilet flush",
    "Train",
    "Train horn",
    "Train whistle",
    "Vehicle",
    "Vehicle horn, car horn, honking",
    "Walk, footsteps",
    "Water",
    "Water tap, faucet",
    "Whack, thwack",
    "Whimper (dog)",
    "Yell",
}


@dataclass(frozen=True)
class Prediction:
    sound: str
    confidence: float


class SoundClassifier(Protocol):
    def classify(self, waveform: np.ndarray) -> list[Prediction]:
        pass


class UnavailableClassifier:
    def classify(self, waveform: np.ndarray) -> list[Prediction]:
        return []


def normalize_label(label: str) -> str:
    aliases = {
        "Baby cry, infant cry": "Baby cry",
        "Air horn, truck horn": "Vehicle horn",
        "Ambulance (siren)": "Siren",
        "Car alarm": "Alarm",
        "Caterwaul": "Cat",
        "Children shouting": "Shouting",
        "Civil defense siren": "Siren",
        "Clapping": "Clap",
        "Crying, sobbing": "Crying",
        "Emergency vehicle": "Siren",
        "Fire engine, fire truck (siren)": "Siren",
        "Firecracker": "Fireworks",
        "Finger snapping": "Snap",
        "Hands": "Clap",
        "Raindrop": "Rain",
        "Rain on surface": "Rain",
        "Police car (siren)": "Siren",
        "Run": "Footsteps",
        "Slap, smack": "Slap",
        "Smoke detector, smoke alarm": "Smoke detector",
        "Telephone": "Phone ringing",
        "Telephone bell ringing": "Phone ringing",
        "Thump, thud": "Impact",
        "Thunder": "Thunderstorm",
        "Vehicle horn, car horn, honking": "Vehicle horn",
        "Walk, footsteps": "Footsteps",
        "Whack, thwack": "Impact",
        "Whimper (dog)": "Dog",
        "Yell": "Shouting",
    }

    if label in {"Bang", "Bouncing", "Basketball bounce"}:
        return "Impact"
    if label in {"Breaking", "Glass"}:
        return "Glass breaking"
    if label in {"Shout", "Screaming"}:
        return "Shouting"

    return aliases.get(label, label)


def filter_predictions(predictions: list[Prediction]) -> list[Prediction]:
    filtered: list[Prediction] = []

    for prediction in predictions:
        if prediction.sound not in IMPORTANT_CLASSES:
            continue

        filtered.append(
            Prediction(
                sound=normalize_label(prediction.sound),
                confidence=prediction.confidence,
            )
        )

    return sorted(filtered, key=lambda item: item.confidence, reverse=True)
