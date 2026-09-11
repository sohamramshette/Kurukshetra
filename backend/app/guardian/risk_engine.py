from typing import Dict, Any, List, Tuple


class RiskEngine:
    """
    Hybrid scoring engine combining deterministic signals and agentic verification evidence.
    See brain.md Section 8 & 9.
    """

    @staticmethod
    def compute_risk(verification_results: Dict[str, Dict[str, Any]]) -> Tuple[int, str, List[Dict[str, Any]]]:
        base_score = 10  # Baseline safe score
        signals: List[Dict[str, Any]] = []

        # 1. Evaluate tool status results and score deltas
        for tool_name, result in verification_results.items():
            status = result.get("status", "PASSED")
            details = result.get("details", {})
            delta = details.get("score_delta", 0)

            base_score += delta

            # Extract signals from scam_detection if present
            if tool_name == "detect_scam_patterns":
                detected = details.get("detected_patterns", [])
                for pattern in detected:
                    signals.append(pattern)

            # Check if recipient failed
            elif tool_name == "check_recipient_profile" and status == "FAILED":
                signals.append({
                    "type": "NEW_UNVERIFIED_RECIPIENT",
                    "severity": "HIGH",
                    "confidence": 0.95,
                    "reason": result.get("summary", "New recipient with no payment history"),
                    "score_delta": delta
                })

            # Check if amount was anomalous
            elif tool_name == "check_transaction_history" and status == "ANOMALOUS":
                signals.append({
                    "type": "UNUSUAL_AMOUNT_DEVIATION",
                    "severity": "HIGH",
                    "confidence": 0.90,
                    "reason": result.get("summary", "Amount significantly exceeds baseline"),
                    "score_delta": delta
                })

            # Check if identity claim failed
            elif tool_name == "verify_identity_claim" and status == "FAILED":
                signals.append({
                    "type": "IDENTITY_MISMATCH",
                    "severity": "CRITICAL",
                    "confidence": 0.98,
                    "reason": result.get("summary", "Claimed identity does not match destination account"),
                    "score_delta": delta
                })

            # Check reputation failure
            elif tool_name == "check_recipient_reputation" and status == "FAILED":
                signals.append({
                    "type": "REPUTATION_DISPUTE_FLAG",
                    "severity": "HIGH",
                    "confidence": 0.92,
                    "reason": result.get("summary", "Recipient flagged in community dispute database"),
                    "score_delta": delta
                })

        # Bound score between 0 and 100
        final_score = max(0, min(100, base_score))

        # Assign Risk Level (brain.md Section 9)
        if final_score >= 75:
            risk_level = "CRITICAL"
        elif final_score >= 50:
            risk_level = "HIGH"
        elif final_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return final_score, risk_level, signals
