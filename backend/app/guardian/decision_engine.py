from typing import List, Dict, Any


class DecisionEngine:
    """
    Deterministic policy enforcement governing financial actions.
    Ensures LLM/AI outputs cannot directly execute payment actions without policy approval.
    See brain.md Section 24 & 39.
    """

    @staticmethod
    def enforce_policy(
        risk_score: int,
        risk_level: str,
        signals: List[Dict[str, Any]],
        verification_results: Dict[str, Dict[str, Any]]
    ) -> str:
        signal_types = {s.get("type") for s in signals}

        # Hard Rule 1: Prompt Injection Attempt -> BLOCK immediately (Section 25)
        if "PROMPT_INJECTION_ATTEMPT" in signal_types:
            return "BLOCK"

        # Hard Rule 2: Identity Mismatch + Urgency / Scam Bait -> HOLD (Section 39)
        if "IDENTITY_MISMATCH" in signal_types and (
            "URGENCY_PRESSURE" in signal_types or "REFUND_PRIZE_BAIT" in signal_types or "AUTHORITY_IMPERSONATION" in signal_types
        ):
            return "HOLD"

        # Threshold Policy:
        if risk_score >= 80:
            return "HOLD"
        elif risk_score >= 50:
            return "STEP_UP"
        elif risk_score >= 25:
            return "WARN"
        else:
            return "ALLOW"
