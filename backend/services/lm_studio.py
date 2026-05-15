from __future__ import annotations

import os

import requests


DEFAULT_BASE_URL = "http://127.0.0.1:1234/v1"
DEFAULT_MODEL = "gemma-4-e4b-it-mlx"


class LMStudioAlertWriter:
    def __init__(self) -> None:
        self.base_url = os.getenv("LM_STUDIO_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
        self.model = os.getenv("LM_STUDIO_MODEL", DEFAULT_MODEL)

    @property
    def is_configured(self) -> bool:
        return self.is_reachable()

    def is_reachable(self) -> bool:
        try:
            response = requests.get(f"{self.base_url}/models", timeout=3)
            response.raise_for_status()
            models = response.json().get("data", [])
            return any(model.get("id") == self.model for model in models)
        except Exception:
            return False

    def generate(
        self,
        *,
        sound: str,
        priority: str,
        confidence: float,
        fallback: str,
    ) -> str:
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You write accessibility alerts for deaf and "
                                "hard-of-hearing users. Return one short, clear "
                                "sentence under 15 words. Do not mention AI, "
                                "confidence scores, or uncertainty disclaimers."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Sound: {sound}\n"
                                f"Priority: {priority}\n"
                                f"Confidence: {confidence:.2f}"
                            ),
                        },
                    ],
                    "max_tokens": 32,
                    "temperature": 0.2,
                    "stream": False,
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
            message = payload["choices"][0]["message"]["content"].strip()
            return sanitize_message(message) or fallback
        except Exception:
            return fallback


def sanitize_message(message: str) -> str:
    cleaned = " ".join(message.replace("\n", " ").split())
    cleaned = cleaned.strip("\"' ")

    if not cleaned:
        return ""

    words = cleaned.split()
    if len(words) > 15:
        cleaned = " ".join(words[:15]).rstrip(".,;:") + "."

    return cleaned

