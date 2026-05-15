from __future__ import annotations

import numpy as np


class AudioBuffer:
    def __init__(
        self,
        sample_rate: int = 16_000,
        window_seconds: float = 2.0,
        hop_seconds: float = 1.0,
    ) -> None:
        self.sample_rate = sample_rate
        self.window_size = int(sample_rate * window_seconds)
        self.hop_size = int(sample_rate * hop_seconds)
        self._samples = np.array([], dtype=np.float32)

    def add_chunk(self, chunk: np.ndarray) -> list[np.ndarray]:
        if chunk.dtype != np.float32:
            chunk = chunk.astype(np.float32)

        self._samples = np.concatenate([self._samples, chunk])
        windows: list[np.ndarray] = []

        while len(self._samples) >= self.window_size:
            windows.append(self._samples[: self.window_size].copy())
            self._samples = self._samples[self.hop_size :]

        return windows

    @property
    def buffered_samples(self) -> int:
        return int(len(self._samples))

