# Antibody gateway + console
# Single stateful web service: FastAPI + WebSocket + static React console.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first so they cache across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code and the static console it serves.
COPY api ./api
COPY web ./web
COPY scripts ./scripts

EXPOSE 8000

# Platforms (Render, Railway, Fly) inject $PORT; default to 8000 for local runs.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
