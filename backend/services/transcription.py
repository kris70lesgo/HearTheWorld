from __future__ import annotations

import os
from functools import lru_cache
from threading import Lock

import numpy as np


class WhisperTranscriber:
    def __init__(
        self,
        model_size: str | None = None,
        device: str | None = None,
        compute_type: str | None = None,
    ) -> None:
        from faster_whisper import WhisperModel

        self.model_size = model_size or os.getenv("WHISPER_MODEL_SIZE", "base.en")
        self.device = device or os.getenv("WHISPER_DEVICE", "cpu")
        self.compute_type = compute_type or os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        self.beam_size = int(os.getenv("WHISPER_BEAM_SIZE", "1"))
        self._lock = Lock()
        self.model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type,
        )

    def transcribe(self, waveform: np.ndarray) -> str:
        if waveform.size == 0:
            return ""

        rms = float(np.sqrt(np.mean(np.square(waveform.astype(np.float32)))))
        if rms < 0.004:
            return ""

        with self._lock:
            segments, _ = self.model.transcribe(
                waveform.astype(np.float32),
                language="en",
                beam_size=self.beam_size,
                best_of=1,
                vad_filter=False,
                condition_on_previous_text=True,
                temperature=0.0,
                no_speech_threshold=0.35,
                compression_ratio_threshold=2.8,
                log_prob_threshold=-1.2,
            )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return " ".join(text.split())

    @property
    def description(self) -> str:
        return f"{self.model_size} on {self.device}/{self.compute_type}"


@lru_cache(maxsize=1)
def get_transcriber() -> WhisperTranscriber:
    return WhisperTranscriber()
