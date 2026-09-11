from typing import List, Dict, Any


def generate_explanation(
    action: str,
    risk_level: str,
    signals: List[Dict[str, Any]],
    verification_results: Dict[str, Dict[str, Any]]
) -> str:
    """
    Generates concise, transparent, non-technical explanation for everyday users.
    See brain.md Section 15.
    """
    if action == "ALLOW":
        return "Payment cleared: Recipient profile and amount parameters match verified spending history."

    if action == "BLOCK":
        return "Payment blocked: An adversarial attempt to manipulate security verification was detected."

    reasons: List[str] = []

    # Check specific signals
    signal_types = [s.get("type") for s in signals]
    if "IDENTITY_MISMATCH" in signal_types:
        reasons.append("claimed official role does not match destination address")
    if "URGENCY_PRESSURE" in signal_types:
        reasons.append("artificial urgency pressure detected in payment note")
    if "AUTHORITY_IMPERSONATION" in signal_types:
        reasons.append("unverified entity claiming customer support authority")
    if "REFUND_PRIZE_BAIT" in signal_types:
        reasons.append("payment framed as an advance fee to release funds/refund")
    if "NEW_UNVERIFIED_RECIPIENT" in signal_types:
        reasons.append("recipient is brand new with zero prior payment history")
    if "UNUSUAL_AMOUNT_DEVIATION" in signal_types:
        reasons.append("amount is unusually high compared to typical payments")
    if "REPUTATION_DISPUTE_FLAG" in signal_types:
        reasons.append("recipient has active dispute reports in community intelligence")

    if not reasons:
        return f"Payment held under protective caution due to {risk_level.lower()} risk indicators."

    return f"Payment held because {' and '.join(reasons[:3])}."


def generate_counterfactual(
    action: str,
    verification_results: Dict[str, Dict[str, Any]]
) -> str:
    """
    Generates actionable counterfactual explanation (brain.md Section 34).
    Explains what condition would lower the risk to safely proceed.
    """
    if action == "ALLOW":
        return "No further verification required."

    failed_tools = [
        name for name, res in verification_results.items()
        if res.get("status") in ["FAILED", "ANOMALOUS"]
    ]

    if "verify_identity_claim" in failed_tools:
        return "Risk score would decrease significantly if recipient identity is verified through an official customer support channel."

    if "check_recipient_profile" in failed_tools:
        return "Risk would drop if this recipient is added and verified in your trusted contact book."

    return "Risk would normalize if the payment amount is verified independently with the recipient."
