from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from audio.classifier import Prediction
from services.targeted_detectors import CriticalSoundAnalyzer


@dataclass(frozen=True)
class HybridRule:
    sound: str
    weights: dict[str, float]
    threshold: float
    min_votes: int
    history_size: int = 5


HYBRID_RULES = (
    HybridRule(
        sound="Doorbell",
        weights={
            "Doorbell": 1.0,
            "Bell": 0.42,
            "Bicycle bell": 0.24,
            "Door": 0.14,
        },
        threshold=0.78,
        min_votes=2,
    ),
    HybridRule(
        sound="Knock",
        weights={
            "Knock": 1.0,
            "Door": 0.4,
            "Sliding door": 0.18,
            "Walk, footsteps": 0.1,
        },
        threshold=0.7,
        min_votes=2,
    ),
    HybridRule(
        sound="Thunderstorm",
        weights={
            "Thunderstorm": 1.0,
            "Rain": 0.58,
            "Water": 0.08,
        },
        threshold=0.74,
        min_votes=2,
    ),
    HybridRule(
        sound="Siren",
        weights={
            "Siren": 1.0,
            "Vehicle horn": 0.22,
            "Alarm": 0.2,
        },
        threshold=0.82,
        min_votes=2,
    ),
    HybridRule(
        sound="Smoke detector",
        weights={
            "Smoke detector": 1.0,
            "Fire alarm": 0.9,
            "Alarm": 0.48,
        },
        threshold=0.84,
        min_votes=2,
    ),
    HybridRule(
        sound="Glass breaking",
        weights={
            "Glass breaking": 1.0,
            "Explosion": 0.14,
        },
        threshold=0.82,
        min_votes=1,
        history_size=3,
    ),
    HybridRule(
        sound="Baby cry",
        weights={
            "Baby cry": 1.0,
            "Crying": 0.42,
            "Speech": 0.12,
        },
        threshold=0.76,
        min_votes=2,
    ),
    HybridRule(
        sound="Clap",
        weights={
            "Clap": 1.0,
            "Snap": 0.28,
        },
        threshold=0.74,
        min_votes=1,
        history_size=3,
    ),
    HybridRule(
        sound="Slap",
        weights={
            "Slap": 1.0,
            "Clap": 0.24,
        },
        threshold=0.74,
        min_votes=1,
        history_size=3,
    ),
    HybridRule(
        sound="Impact",
        weights={
            "Impact": 1.0,
            "Footsteps": 0.52,
            "Knock": 0.26,
        },
        threshold=0.76,
        min_votes=1,
        history_size=3,
    ),
)


class HybridSoundDetector:
    def __init__(self, rules: tuple[HybridRule, ...] = HYBRID_RULES) -> None:
        self.rules = rules
        self._analyzer = CriticalSoundAnalyzer()
        self._history = {
            rule.sound: deque(maxlen=rule.history_size) for rule in self.rules
        }

    def evaluate(
        self,
        predictions: list[Prediction],
        waveform,
    ) -> list[Prediction]:
        targeted = self._analyzer.analyze(waveform, predictions)
        combined = [*predictions, *targeted]
        evidence_by_sound: dict[str, float] = {}
        for prediction in combined:
            evidence_by_sound[prediction.sound] = max(
                evidence_by_sound.get(prediction.sound, 0.0),
                prediction.confidence,
            )
        fused: list[Prediction] = []
        claimed_raw_labels: set[str] = set()

        for rule in self.rules:
            window_score = 0.0
            matched_labels: set[str] = set()

            for label, weight in rule.weights.items():
                confidence = evidence_by_sound.get(label, 0.0)
                if confidence <= 0:
                    continue
                matched_labels.add(label)
                window_score = max(window_score, confidence * weight)

            history = self._history[rule.sound]
            history.append(window_score)
            if window_score <= 0:
                continue

            vote_count = sum(1 for score in history if score >= rule.threshold * 0.72)
            if vote_count < rule.min_votes:
                continue

            strongest = sorted(history, reverse=True)[: rule.min_votes + 1]
            averaged = sum(strongest) / len(strongest)
            stability_bonus = min(0.12, max(0, vote_count - rule.min_votes) * 0.04)
            confidence = min(0.99, averaged + stability_bonus)

            if confidence >= rule.threshold:
                fused.append(Prediction(sound=rule.sound, confidence=confidence))
                claimed_raw_labels.update(matched_labels)

        remaining = [
            prediction
            for prediction in combined
            if prediction.sound not in claimed_raw_labels
        ]

        return sorted([*fused, *remaining], key=lambda item: item.confidence, reverse=True)
