# HearTheWorld Backend

FastAPI backend for receiving live browser microphone audio over WebSocket.

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

The backend loads `../.env` for local configuration. LM Studio is used for local LLM alert text:

```bash
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=gemma-4-e4b-it-mlx
```

Realtime captions use `faster-whisper`. The default is a stronger low-latency local model:

```bash
WHISPER_MODEL_SIZE=base.en
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=1
```

For better accuracy on a fast machine, try `WHISPER_MODEL_SIZE=small.en`. For lower latency, use `tiny.en`.

## Endpoints

- `GET /health`
- `WS /audio`
