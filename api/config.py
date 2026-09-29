"""Central config: loads secrets/knobs from environment (.env)."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


@dataclass(frozen=True)
class Settings:
    # Hindsight (managed cloud)
    hindsight_base_url: str = _env("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
    hindsight_api_key: str = _env("HINDSIGHT_API_KEY")
    traffic_bank: str = _env("HINDSIGHT_TRAFFIC_BANK", "antibody-traffic")
    antigen_bank: str = _env("HINDSIGHT_ANTIGEN_BANK", "antibody-antigens")
    dream_bank: str = _env("HINDSIGHT_DREAM_BANK", "antibody-dream")

    # Groq
    groq_api_key: str = _env("GROQ_API_KEY")
    groq_api_key_backup: str = _env("GROQ_API_KEY_BACKUP")
    groq_model: str = _env("GROQ_MODEL", "openai/gpt-oss-120b")
    groq_model_fallback: str = _env("GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")

    # App
    identity_salt: str = _env("IDENTITY_SALT", "antibody-dev-salt-change-me")

    def require(self) -> "Settings":
        missing = [k for k in ("hindsight_api_key",) if not getattr(self, k)]
        if missing:
            raise RuntimeError(f"Missing required settings: {', '.join(missing)}")
        return self


settings = Settings()
