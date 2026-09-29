"""One-off probe: confirm hindsight-client surface + correct base_url against the cloud."""
import inspect
import sys

from hindsight_client import Hindsight

sys.path.insert(0, ".")
from api.config import settings  # noqa: E402

print("=== methods on Hindsight ===")
methods = [m for m in dir(Hindsight) if not m.startswith("_")]
print(", ".join(methods))

print("\n=== signatures ===")
for name in ("create_bank", "update_bank_config", "retain", "retain_batch",
             "recall", "reflect", "create_mental_model", "get_mental_model",
             "list_mental_models", "list_memories"):
    fn = getattr(Hindsight, name, None)
    if fn:
        try:
            print(f"{name}{inspect.signature(fn)}")
        except (ValueError, TypeError):
            print(f"{name}: <no signature>")
    else:
        print(f"{name}: MISSING")

print("\n=== connectivity test ===")
for base in (settings.hindsight_base_url, settings.hindsight_base_url.rstrip("/") + "/v1/default"):
    try:
        c = Hindsight(base_url=base, api_key=settings.hindsight_api_key, timeout=20.0)
        # cheap read against the known empty bank
        res = c.list_memories(bank_id="hackathon", limit=1)
        print(f"OK base_url={base!r} -> list_memories ok: {type(res).__name__}")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL base_url={base!r} -> {type(e).__name__}: {str(e)[:200]}")
