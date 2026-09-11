from typing import Any, Dict


def verify_identity_claim(recipient_id: str, message: str = "") -> Dict[str, Any]:
    """Compare an official-entity claim with handle syntax.

    This is a local consistency heuristic. It does not contact an institution,
    resolve ownership, or externally verify recipient identity.
    """
    lower_msg = message.lower() if message else ""
    claims_authority = any(term in lower_msg for term in ["support", "bank", "officer", "refund", "department"])
    has_recognized_suffix = recipient_id.endswith("@bank") or recipient_id.endswith("@verified")

    if claims_authority and not has_recognized_suffix:
        return {
            "check_name": "Identity Claim Consistency",
            "status": "FAILED",
            "summary": f"The message claims an official role, but handle '{recipient_id}' does not use a recognized demo suffix. Verify through an independently sourced channel.",
            "details": {
                "claims_official": True,
                "handle_suffix_consistent": False,
                "external_verification_performed": False,
                "score_delta": 30,
            },
        }

    if claims_authority:
        return {
            "check_name": "Identity Claim Consistency",
            "status": "ANOMALOUS",
            "summary": "The handle syntax is consistent with the claimed role, but Guardian did not externally verify ownership or identity.",
            "details": {
                "claims_official": True,
                "handle_suffix_consistent": True,
                "external_verification_performed": False,
                "score_delta": 5,
            },
        }

    return {
        "check_name": "Identity Claim Consistency",
        "status": "PASSED",
        "summary": "No official identity claim was present to compare. No external identity verification was performed.",
        "details": {
            "claims_official": False,
            "handle_suffix_consistent": has_recognized_suffix,
            "external_verification_performed": False,
            "score_delta": 0,
        },
    }
