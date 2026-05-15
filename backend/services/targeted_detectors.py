from __future__ import annotations

import numpy as np

from audio.classifier import Prediction


class CriticalSoundAnalyzer:
    def __init__(self, sample_rate: int = 16_000) -> None:
        self.sample_rate = sample_rate

    def analyze(
        self,
        waveform: np.ndarray,
        predictions: list[Prediction],
    ) -> list[Prediction]:
        if waveform.size == 0:
            return []

        normalized = waveform.astype(np.float32)
        peak = float(np.max(np.abs(normalized)))
        if peak <= 1e-6:
            return []
        normalized /= peak

        evidence = {prediction.sound: prediction.confidence for prediction in predictions}
        detections: list[Prediction] = []

        knock_confidence = self._knock_confidence(normalized, evidence)
        if knock_confidence > 0:
            detections.append(Prediction(sound="Knock", confidence=knock_confidence))

        doorbell_confidence = self._doorbell_confidence(normalized, evidence)
        if doorbell_confidence > 0:
            detections.append(Prediction(sound="Doorbell", confidence=doorbell_confidence))

        smoke_confidence = self._smoke_alarm_confidence(normalized, evidence)
        if smoke_confidence > 0:
            detections.append(Prediction(sound="Smoke detector", confidence=smoke_confidence))

        glass_confidence = self._glass_breaking_confidence(normalized, evidence)
        if glass_confidence > 0:
            detections.append(Prediction(sound="Glass breaking", confidence=glass_confidence))

        detections.extend(self._percussive_event_predictions(normalized, evidence))

        return detections

    def _knock_confidence(
        self,
        waveform: np.ndarray,
        evidence: dict[str, float],
    ) -> float:
        envelope = self._smoothed_envelope(waveform, window_size=128)
        noise_floor = float(np.percentile(envelope, 55))
        spread = float(np.std(envelope))
        threshold = max(noise_floor + spread * 2.2, noise_floor * 2.8, 0.018)

        peak_indices = self._find_peaks(envelope, threshold)
        if not peak_indices:
            return 0.0

        merged_peaks = self._merge_nearby_peaks(
            peak_indices,
            envelope,
            min_gap_samples=int(self.sample_rate * 0.04),
        )
        if len(merged_peaks) == 0 or len(merged_peaks) > 6:
            return 0.0

        widths = [self._peak_width(envelope, peak, threshold * 0.55) for peak in merged_peaks]
        short_hits = sum(1 for width in widths if width <= int(self.sample_rate * 0.11))
        if short_hits == 0:
            return 0.0

        intervals = np.diff(merged_peaks)
        rhythmic_hits = sum(
            1
            for gap in intervals
            if int(self.sample_rate * 0.04) <= gap <= int(self.sample_rate * 0.45)
        )
        active_ratio = float(np.mean(envelope > threshold * 0.8))
        peak_strength = max(float(envelope[peak]) for peak in merged_peaks)

        transient_window = waveform[max(0, merged_peaks[0] - 512): min(len(waveform), merged_peaks[0] + 2048)]
        bright_transient_ratio = 0.0
        if transient_window.size >= 512:
            taper = np.hanning(transient_window.size)
            spectrum = np.abs(np.fft.rfft(transient_window * taper))
            freqs = np.fft.rfftfreq(transient_window.size, d=1.0 / self.sample_rate)
            high_energy = float(np.sum(spectrum[freqs >= 2500] ** 2))
            mid_energy = float(np.sum(spectrum[(freqs >= 400) & (freqs < 2500)] ** 2)) + 1e-8
            bright_transient_ratio = high_energy / mid_energy

        score = 0.0
        score += min(0.42, peak_strength * 0.38)
        score += min(0.2, short_hits * 0.08)
        score += min(0.18, rhythmic_hits * 0.09)
        score += 0.08 if 1 <= len(merged_peaks) <= 4 else 0.0
        score -= min(0.22, max(0.0, active_ratio - 0.14) * 1.6)
        score -= min(0.28, max(0.0, bright_transient_ratio - 1.15) * 0.22)

        yamnet_support = max(
            evidence.get("Knock", 0.0),
            evidence.get("Door", 0.0) * 0.62,
            evidence.get("Sliding door", 0.0) * 0.28,
            evidence.get("Walk, footsteps", 0.0) * 0.18,
        )

        if yamnet_support > 0:
            score += yamnet_support * 0.38
        else:
            score = min(score, 0.62)

        return min(0.95, max(0.0, score))

    def _doorbell_confidence(
        self,
        waveform: np.ndarray,
        evidence: dict[str, float],
    ) -> float:
        envelope = self._smoothed_envelope(waveform, window_size=256)
        peak_env = float(np.max(envelope))
        if peak_env < 0.035:
            return 0.0

        sustain_threshold = max(peak_env * 0.46, 0.02)
        sustain_run = self._longest_run(envelope > sustain_threshold) / self.sample_rate
        if sustain_run < 0.18:
            return 0.0

        window = np.hanning(waveform.size)
        spectrum = np.abs(np.fft.rfft(waveform * window))
        freqs = np.fft.rfftfreq(waveform.size, d=1.0 / self.sample_rate)

        band_mask = (freqs >= 450) & (freqs <= 3800)
        if not np.any(band_mask):
            return 0.0

        band = spectrum[band_mask]
        total_energy = float(np.sum(spectrum**2)) + 1e-8
        band_energy_ratio = float(np.sum(band**2) / total_energy)
        if band_energy_ratio < 0.24:
            return 0.0

        dominant_freq = float(freqs[band_mask][int(np.argmax(band))])

        peak_mag = float(np.max(band))
        mean_mag = float(np.mean(band)) + 1e-6
        tonal_ratio = peak_mag / mean_mag

        prob = band / (float(np.sum(band)) + 1e-8)
        entropy = -float(np.sum(prob * np.log(prob + 1e-8))) / np.log(prob.size + 1e-8)
        tonal_focus = max(0.0, 1.0 - entropy)

        score = 0.0
        score += min(0.32, max(0.0, tonal_ratio - 3.0) * 0.06)
        score += min(0.24, band_energy_ratio * 0.34)
        score += min(0.16, sustain_run * 0.22)
        score += min(0.12, tonal_focus * 0.28)

        yamnet_support = max(
            evidence.get("Doorbell", 0.0),
            evidence.get("Bell", 0.0) * 0.72,
            evidence.get("Bicycle bell", 0.0) * 0.42,
            evidence.get("Door", 0.0) * 0.12,
        )
        alarm_support = max(
            evidence.get("Smoke detector", 0.0),
            evidence.get("Fire alarm", 0.0),
            evidence.get("Alarm", 0.0) * 0.48,
        )

        if dominant_freq > 2350 and alarm_support >= yamnet_support:
            return 0.0

        if yamnet_support > 0:
            score += yamnet_support * 0.34
        else:
            score = min(score, 0.58)

        return min(0.95, max(0.0, score))

    def _smoke_alarm_confidence(
        self,
        waveform: np.ndarray,
        evidence: dict[str, float],
    ) -> float:
        window = np.hanning(waveform.size)
        spectrum = np.abs(np.fft.rfft(waveform * window))
        freqs = np.fft.rfftfreq(waveform.size, d=1.0 / self.sample_rate)

        focus_mask = (freqs >= 1800) & (freqs <= 4200)
        if not np.any(focus_mask):
            return 0.0

        band = spectrum[focus_mask]
        total_energy = float(np.sum(spectrum**2)) + 1e-8
        band_energy_ratio = float(np.sum(band**2) / total_energy)
        if band_energy_ratio < 0.18:
            return 0.0

        peak_mag = float(np.max(band))
        mean_mag = float(np.mean(band)) + 1e-6
        tonal_ratio = peak_mag / mean_mag
        if tonal_ratio < 5.0:
            return 0.0

        envelope = self._smoothed_envelope(waveform, window_size=256)
        sustain_threshold = max(float(np.max(envelope)) * 0.42, 0.018)
        sustain_run = self._longest_run(envelope > sustain_threshold) / self.sample_rate

        score = 0.0
        score += min(0.32, band_energy_ratio * 0.42)
        score += min(0.28, max(0.0, tonal_ratio - 4.0) * 0.055)
        score += min(0.12, sustain_run * 0.18)

        yamnet_support = max(
            evidence.get("Smoke detector", 0.0),
            evidence.get("Fire alarm", 0.0) * 0.92,
            evidence.get("Alarm", 0.0) * 0.44,
        )

        if yamnet_support > 0:
            score += yamnet_support * 0.38
        else:
            score = min(score, 0.54)

        return min(0.97, max(0.0, score))

    def _glass_breaking_confidence(
        self,
        waveform: np.ndarray,
        evidence: dict[str, float],
    ) -> float:
        envelope = self._smoothed_envelope(waveform, window_size=64)
        noise_floor = float(np.percentile(envelope, 45))
        threshold = max(noise_floor * 4.2, noise_floor + float(np.std(envelope)) * 2.8, 0.02)

        peaks = self._find_peaks(envelope, threshold)
        if not peaks:
            return 0.0

        first_peak = peaks[0]
        burst_width = self._peak_width(envelope, first_peak, threshold * 0.52)
        if burst_width > int(self.sample_rate * 0.16):
            return 0.0

        transient_window = waveform[max(0, first_peak - 1024): min(len(waveform), first_peak + 4096)]
        if transient_window.size < 512:
            return 0.0

        taper = np.hanning(transient_window.size)
        spectrum = np.abs(np.fft.rfft(transient_window * taper))
        freqs = np.fft.rfftfreq(transient_window.size, d=1.0 / self.sample_rate)

        high_mask = freqs >= 2500
        mid_mask = (freqs >= 700) & (freqs < 2500)
        if not np.any(high_mask) or not np.any(mid_mask):
            return 0.0

        high_energy = float(np.sum(spectrum[high_mask] ** 2))
        mid_energy = float(np.sum(spectrum[mid_mask] ** 2)) + 1e-8
        high_ratio = high_energy / (high_energy + mid_energy)
        sparkle_ratio = high_energy / mid_energy

        if high_ratio < 0.36:
            return 0.0

        score = 0.0
        score += min(0.34, high_ratio * 0.5)
        score += min(0.24, max(0.0, sparkle_ratio - 0.75) * 0.16)
        score += min(0.12, float(np.max(envelope)) * 0.16)
        score += 0.08 if len(peaks) <= 4 else 0.0

        yamnet_support = max(
            evidence.get("Glass breaking", 0.0),
            evidence.get("Explosion", 0.0) * 0.16,
        )

        if yamnet_support > 0:
            score += yamnet_support * 0.4
        else:
            score = min(score, 0.6)

        return min(0.97, max(0.0, score))

    def _percussive_event_predictions(
        self,
        waveform: np.ndarray,
        evidence: dict[str, float],
    ) -> list[Prediction]:
        envelope = self._smoothed_envelope(waveform, window_size=64)
        noise_floor = float(np.percentile(envelope, 50))
        threshold = max(noise_floor + float(np.std(envelope)) * 2.6, noise_floor * 3.4, 0.018)
        peaks = self._merge_nearby_peaks(
            self._find_peaks(envelope, threshold),
            envelope,
            min_gap_samples=int(self.sample_rate * 0.045),
        )
        if not peaks or len(peaks) > 8:
            return []

        strongest_peak = max(peaks, key=lambda peak: envelope[peak])
        burst_width = self._peak_width(envelope, strongest_peak, threshold * 0.5)
        if burst_width > int(self.sample_rate * 0.2):
            return []

        start = max(0, strongest_peak - 768)
        end = min(len(waveform), strongest_peak + 3072)
        burst = waveform[start:end]
        if burst.size < 512:
            return []

        taper = np.hanning(burst.size)
        spectrum = np.abs(np.fft.rfft(burst * taper))
        freqs = np.fft.rfftfreq(burst.size, d=1.0 / self.sample_rate)
        total_energy = float(np.sum(spectrum**2)) + 1e-8
        low_energy = float(np.sum(spectrum[freqs < 350] ** 2))
        mid_energy = float(np.sum(spectrum[(freqs >= 350) & (freqs < 2200)] ** 2))
        high_energy = float(np.sum(spectrum[freqs >= 2200] ** 2))
        low_ratio = low_energy / total_energy
        high_ratio = high_energy / total_energy
        peak_strength = float(envelope[strongest_peak])

        clap_support = max(
            evidence.get("Clap", 0.0),
            evidence.get("Snap", 0.0) * 0.45,
        )
        slap_support = evidence.get("Slap", 0.0)
        impact_support = max(
            evidence.get("Impact", 0.0),
            evidence.get("Footsteps", 0.0) * 0.5,
            evidence.get("Knock", 0.0) * 0.32,
        )

        predictions: list[Prediction] = []
        bright_hit_score = 0.0
        if high_ratio >= 0.18 and burst_width <= int(self.sample_rate * 0.1):
            bright_hit_score += min(0.34, high_ratio * 0.68)
            bright_hit_score += min(0.2, peak_strength * 0.22)
            bright_hit_score += 0.08 if 1 <= len(peaks) <= 4 else 0.0

        clap_score = bright_hit_score + clap_support * 0.42
        if clap_support <= 0:
            clap_score = min(clap_score, 0.68)
        if clap_score >= 0.46:
            predictions.append(Prediction(sound="Clap", confidence=min(0.95, clap_score)))

        slap_score = bright_hit_score + slap_support * 0.48
        slap_score += min(0.12, max(0.0, mid_energy / total_energy - 0.34) * 0.32)
        if slap_support <= 0:
            slap_score = min(slap_score, 0.62)
        if slap_score >= 0.48:
            predictions.append(Prediction(sound="Slap", confidence=min(0.95, slap_score)))

        impact_score = 0.0
        if low_ratio >= 0.22:
            impact_score += min(0.34, low_ratio * 0.72)
            impact_score += min(0.18, peak_strength * 0.2)
            impact_score += 0.08 if len(peaks) <= 3 else 0.0
        impact_score += impact_support * 0.38
        if impact_support <= 0:
            impact_score = min(impact_score, 0.64)
        if impact_score >= 0.46:
            predictions.append(Prediction(sound="Impact", confidence=min(0.95, impact_score)))

        return predictions

    def _smoothed_envelope(self, waveform: np.ndarray, window_size: int) -> np.ndarray:
        kernel = np.ones(window_size, dtype=np.float32) / max(1, window_size)
        return np.convolve(np.abs(waveform), kernel, mode="same")

    def _find_peaks(self, envelope: np.ndarray, threshold: float) -> list[int]:
        peaks: list[int] = []
        for index in range(1, len(envelope) - 1):
            center = envelope[index]
            if center < threshold:
                continue
            if center >= envelope[index - 1] and center > envelope[index + 1]:
                peaks.append(index)
        return peaks

    def _merge_nearby_peaks(
        self,
        peaks: list[int],
        envelope: np.ndarray,
        min_gap_samples: int,
    ) -> list[int]:
        if not peaks:
            return []

        merged = [peaks[0]]
        for peak in peaks[1:]:
            if peak - merged[-1] <= min_gap_samples:
                if envelope[peak] > envelope[merged[-1]]:
                    merged[-1] = peak
                continue
            merged.append(peak)
        return merged

    def _peak_width(self, envelope: np.ndarray, peak_index: int, threshold: float) -> int:
        left = peak_index
        right = peak_index

        while left > 0 and envelope[left] > threshold:
            left -= 1
        while right < len(envelope) - 1 and envelope[right] > threshold:
            right += 1

        return right - left

    def _longest_run(self, mask: np.ndarray) -> int:
        best = 0
        current = 0
        for value in mask:
            if value:
                current += 1
                best = max(best, current)
            else:
                current = 0
        return best
