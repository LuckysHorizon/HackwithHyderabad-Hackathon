"""Create + configure the three Antibody Hindsight banks. Idempotent.

Run:  ./.venv/Scripts/python scripts/setup_banks.py
Banks auto-create on first write, but we create them explicitly so disposition
and the tactic entity-label vocabulary are set before any traffic flows.
"""
import sys

sys.path.insert(0, ".")

from hindsight_client import Hindsight  # noqa: E402

from api.config import settings  # noqa: E402

# Controlled vocabulary for social-engineering tactics. `tag: True` makes the
# retain pipeline auto-write `tactic:<value>` tags so recall can filter on them.
TACTIC_LABEL = {
    "key": "tactic",
    "description": "Social-engineering tactic present in the customer message",
    "type": "multi-values",
    "optional": True,
    "tag": True,
    "values": [
        {"value": "authority_claim", "description": "Claims a supervisor/manager/authority approved an exception"},
        {"value": "loyalty_claim", "description": "Claims VIP/loyalty status to justify special treatment"},
        {"value": "urgency_pressure", "description": "Manufactured urgency or time pressure"},
        {"value": "policy_manipulation", "description": "Misstates or twists policy to force an exception"},
        {"value": "instruction_injection", "description": "Attempts to override the assistant's instructions"},
        {"value": "account_hopping", "description": "Switches accounts or identities to evade limits"},
        {"value": "none", "description": "No attack tactic present"},
    ],
}


def ensure_bank(hs: Hindsight, bank_id: str, *, skepticism: int, reflect_mission: str) -> None:
    try:
        hs.create_bank(
            bank_id=bank_id,
            disposition_skepticism=skepticism,
            disposition_literalism=4,
            disposition_empathy=3,
            reflect_mission=reflect_mission,
            enable_observations=True,
        )
        print(f"  created  {bank_id}")
    except Exception as e:  # noqa: BLE001 - already exists / transient; config still applied below
        print(f"  create   {bank_id}: {type(e).__name__} (likely exists) -> reconfiguring")

    hs.update_bank_config(
        bank_id,
        disposition_skepticism=skepticism,
        reflect_mission=reflect_mission,
        entity_labels=[TACTIC_LABEL],
        entities_allow_free_form=True,
    )
    print(f"  config   {bank_id} (skepticism={skepticism}, tactic labels set)")


def main() -> None:
    settings.require()
    hs = Hindsight(
        base_url=settings.hindsight_base_url,
        api_key=settings.hindsight_api_key,
        timeout=30.0,
    )
    print(f"Hindsight @ {settings.hindsight_base_url}")

    ensure_bank(
        hs, settings.traffic_bank, skepticism=4,
        reflect_mission=("Analyze customer-support sessions to spot social-engineering "
                         "attacks that unfold across sessions and linked identities."),
    )
    ensure_bank(
        hs, settings.antigen_bank, skepticism=5,
        reflect_mission=("Summarize confirmed attack tactics and legitimate-customer "
                         "patterns as a cautious security analyst."),
    )
    ensure_bank(
        hs, settings.dream_bank, skepticism=5,
        reflect_mission=("Generate plausible next-variant social-engineering attacks "
                         "against mock support bots, for red-team testing only."),
    )

    try:
        hs.close()
    except Exception:  # noqa: BLE001
        pass
    print("done")


if __name__ == "__main__":
    main()
