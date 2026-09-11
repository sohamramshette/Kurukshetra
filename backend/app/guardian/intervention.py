from typing import Dict, Any


def determine_intervention(action: str) -> Dict[str, Any]:
    """
    Translates protective action into adaptive UI friction policy.
    See brain.md Section 12.
    """
    if action == "ALLOW":
        return {
            "ui_mode": "SILENT",
            "friction_level": "NONE",
            "cooling_period_seconds": 0,
            "requires_explicit_override": False,
            "primary_button": "Pay Now"
        }
    elif action == "WARN":
        return {
            "ui_mode": "SOFT_WARNING",
            "friction_level": "LOW",
            "cooling_period_seconds": 0,
            "requires_explicit_override": True,
            "primary_button": "I Understand, Proceed"
        }
    elif action == "STEP_UP":
        return {
            "ui_mode": "STEP_UP_VERIFICATION",
            "friction_level": "MEDIUM",
            "cooling_period_seconds": 30,
            "requires_explicit_override": True,
            "primary_button": "Verify Recipient & Proceed"
        }
    elif action == "HOLD":
        return {
            "ui_mode": "PROTECTIVE_HOLD",
            "friction_level": "HIGH",
            "cooling_period_seconds": 120,
            "requires_explicit_override": True,
            "primary_button": "Verify Independently"
        }
    else:  # BLOCK
        return {
            "ui_mode": "HARD_BLOCK",
            "friction_level": "MAXIMUM",
            "cooling_period_seconds": 0,
            "requires_explicit_override": False,
            "primary_button": "Transaction Blocked"
        }
