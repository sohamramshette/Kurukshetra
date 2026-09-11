from typing import Dict, Any


def check_recipient_profile(user_id: str, recipient_id: str) -> Dict[str, Any]:
    """
    Tool 2: Evaluates recipient novelty, prior payment history, and account profile.
    See brain.md Section 8 & 10.
    """
    known_safe_recipients = {
        "mom@upi", "landlord@bank", "grocery@store", "friend@upi", "zomato@icici"
    }

    suspicious_keywords = ["support", "refund", "prize", "lottery", "kyc", "darknet", "verify"]
    is_suspicious_handle = any(kw in recipient_id.lower() for kw in suspicious_keywords)

    if recipient_id.lower() in known_safe_recipients:
        return {
            "check_name": "Recipient Profile & History",
            "status": "PASSED",
            "summary": f"Recipient '{recipient_id}' is a verified frequent contact with established transaction history.",
            "details": {
                "is_new": False,
                "prior_transactions": 12,
                "reputation": "TRUSTED",
                "score_delta": -15
            }
        }

    if is_suspicious_handle:
        return {
            "check_name": "Recipient Profile & History",
            "status": "FAILED",
            "summary": f"Recipient '{recipient_id}' is newly created (0 prior transactions) with suspicious naming patterns.",
            "details": {
                "is_new": True,
                "prior_transactions": 0,
                "reputation": "SUSPICIOUS",
                "score_delta": 25
            }
        }

    # Standard new recipient (first time paying, but handle is neutral)
    return {
        "check_name": "Recipient Profile & History",
        "status": "ANOMALOUS",
        "summary": f"First-time payment to recipient '{recipient_id}'. No historical interaction recorded.",
        "details": {
            "is_new": True,
            "prior_transactions": 0,
            "reputation": "NEUTRAL",
            "score_delta": 15
        }
    }
