from __future__ import annotations

import csv
from functools import lru_cache

import numpy as np

from audio.classifier import Prediction, SoundClassifier


YAMNET_MODEL_URL = "https://tfhub.dev/google/yamnet/1"


class YamnetClassifier(SoundClassifier):
    def __init__(self) -> None:
        import tensorflow_hub as hub

        self._model = hub.load(YAMNET_MODEL_URL)
        self._labels = self._load_labels()

    def classify(self, waveform: np.ndarray) -> list[Prediction]:
        import tensorflow as tf

        tensor = tf.convert_to_tensor(waveform, dtype=tf.float32)
        scores, _, _ = self._model(tensor)
        scores_np = scores.numpy()

        if scores_np.size == 0:
            return []

        class_scores = np.max(scores_np, axis=0)
        top_indices = np.argsort(class_scores)[::-1][:10]

        return [
            Prediction(
                sound=self._labels[index],
                confidence=float(class_scores[index]),
            )
            for index in top_indices
        ]

    def _load_labels(self) -> list[str]:
        class_map_path = self._model.class_map_path().numpy().decode("utf-8")

        with open(class_map_path, newline="", encoding="utf-8") as class_map:
            reader = csv.DictReader(class_map)
            return [row["display_name"] for row in reader]


@lru_cache(maxsize=1)
def get_classifier() -> YamnetClassifier:
    return YamnetClassifier()

