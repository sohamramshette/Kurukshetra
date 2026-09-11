from typing import Dict, Any


def verify_identity_claim(recipient_id: str, message: str = "") -> Dict[str, Any]:
    """
    Tool 5: Validates claimed identity in context against destination VPA.
    See brain.md Section 8 & 27.
    """
    lower_msg = message.lower() if message else ""

    claims_authority = any(term in lower_msg for term in ["support", "bank", "officer", "refund", "department"])
    is_verified_channel = recipient_id.endswith("@bank") or recipient_id.endswith("@verified")

    if claims_authority and not is_verified_channel:
        return {
            "check_name": "Identity Claim Verification",
            "status": "FAILED",
            "summary": f"Discrepancy: Message claims official entity status, but destination address '{recipient_id}' is an unverified personal handle.",
            "details": {
                "claims_official": True,
                "verified_handle": False,
                "score_delta": 30
            }
        }

    return {
        "check_name": "Identity Claim Verification",
        "status": "PASSED",
        "summary": "No mismatch between claimed persona and payment recipient handle.",
        "details": {
            "claims_official": claims_authority,
            "verified_handle": is_verified_channel,
            "score_delta": -5
        }
    }
