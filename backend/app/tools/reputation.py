from typing import Dict, Any


def check_recipient_reputation(recipient_id: str) -> Dict[str, Any]:
    """
    Tool 3: Checks simulated community dispute intelligence and fraud database reports.
    See brain.md Section 8 & 32.
    """
    flagged_handles = {
        "support-verify@demo": 4,
        "refund-desk@demo": 7,
        "prize-desk@demo": 12,
        "attacker@darknet": 19
    }

    reports = flagged_handles.get(recipient_id.lower(), 0)

    if reports > 0:
        return {
            "check_name": "Collective Intelligence & Reputation",
            "status": "FAILED",
            "summary": f"Recipient '{recipient_id}' has {reports} independent community fraud reports in the last 48 hours.",
            "details": {
                "active_disputes": reports,
                "reputation_score": max(5, 100 - (reports * 15)),
                "score_delta": 25
            }
        }

    return {
        "check_name": "Collective Intelligence & Reputation",
        "status": "PASSED",
        "summary": "Clear record. 0 community dispute reports in collective threat intelligence database.",
        "details": {
            "active_disputes": 0,
            "reputation_score": 98,
            "score_delta": -5
        }
    }
