from typing import Dict, Any, List
from app.services.llm_service import gemini_service
from app.services.vector_service import vector_service

SCAM_SIGNALS = {
    "PROMPT_INJECTION": [
        "ignore all previous instructions",
        "system override",
        "mark safe",
        "bypass guardian",
        "disregard safety",
        "admin mode"
    ],
    "URGENCY": [
        "urgent",
        "immediately",
        "expires today",
        "within 10 minutes",
        "within 5 minutes",
        "hurry",
        "act now",
        "penalty",
        "disconnected"
    ],
    "AUTHORITY": [
        "official bank",
        "customer support",
        "support team",
        "kyc officer",
        "police",
        "electricity department",
        "tax authority"
    ],
    "REFUND_OR_PRIZE": [
        "refund verification",
        "lottery winnings",
        "prize",
        "cashback reward",
        "claim refund",
        "unfreeze account"
    ]
}


def detect_scam_patterns(
    message: str = "",
    recipient_id: str = "",
    amount: float = 0.0
) -> Dict[str, Any]:
    """
    Tool 4: Analyzes natural language context for scam tactics and adversarial prompt injection attempts.
    Multi-layer intelligence:
    1. Local semantic similarity against the bundled scam-pattern corpus.
    2. Optional Gemini classification over explicitly untrusted note text.
    3. Deterministic prompt-injection and scam heuristics as a fail-safe.
    See brain.md Section 8, 18, 25 & 37.
    """
    if not message:
        return {
            "check_name": "Scam Intent & Language Analysis",
            "status": "PASSED",
            "summary": "No context message attached to this transaction.",
            "details": {
                "detected_patterns": [],
                "score_delta": 0,
                "is_injection": False,
                "engine": "Deterministic"
            }
        }

    detected_patterns: List[Dict[str, Any]] = []
    lower = message.lower()

    # Deterministic injection scanning always runs. Optional model output may
    # add context, but can never suppress this payment-policy boundary.
    injection_trigger = next((trigger for trigger in SCAM_SIGNALS["PROMPT_INJECTION"] if trigger in lower), None)
    if injection_trigger:
        detected_patterns.append({
            "type": "PROMPT_INJECTION_ATTEMPT",
            "source": "deterministic",
            "confidence": 0.99,
            "reason": f"Adversarial instruction injection detected: '{injection_trigger}'.",
            "score_delta": 35
        })

    # 1. Local semantic similarity against the bundled scam-pattern corpus
    vector_match = vector_service.match_scam_pattern(message)
    if vector_match:
        detected_patterns.append({
            "type": "SEMANTIC_SCAM_VECTOR_MATCH",
            "source": "local_semantic",
            "severity": "CRITICAL" if vector_match["similarity_pct"] >= 65 else "HIGH",
            "confidence": vector_match["similarity_score"],
            "reason": f"Local semantic matcher found '{vector_match['pattern_name']}' ({vector_match['similarity_pct']}% similarity).",
            "score_delta": vector_match["score_delta"],
            "reference_sample": vector_match["reference_sample"]
        })

    # Deterministic scam heuristics always run and are merged with optional
    # model context. Model output can never suppress these boundaries.
    deterministic_checks = (
        ("URGENCY", "URGENCY_PRESSURE", 0.92, 20, "Artificial urgency phrase detected"),
        ("AUTHORITY", "AUTHORITY_IMPERSONATION", 0.89, 25, "Sender claims official authority"),
        ("REFUND_OR_PRIZE", "REFUND_PRIZE_BAIT", 0.91, 25, "Advance-fee bait pattern detected"),
    )
    for signal_group, signal_type, confidence, score_delta, reason in deterministic_checks:
        trigger = next((item for item in SCAM_SIGNALS[signal_group] if item in lower), None)
        if trigger:
            detected_patterns.append({
                "type": signal_type,
                "source": "deterministic",
                "severity": "HIGH",
                "confidence": confidence,
                "reason": f"{reason}: '{trigger}'.",
                "score_delta": score_delta,
            })

    # 2. Try Gemini Flash Lite analysis (if configured)
    gemini_result = gemini_service.analyze_scam_intent(message, recipient_id, amount)

    if gemini_result is not None:
        if (gemini_result["is_injection_attempt"] or gemini_result["scam_category"] == "PROMPT_INJECTION") and not injection_trigger:
            detected_patterns.append({
                "type": "PROMPT_INJECTION_ATTEMPT",
                "source": "model",
                "confidence": gemini_result["confidence"],
                "reason": gemini_result["summary"] or "Adversarial prompt injection attempt detected by Gemini.",
                "score_delta": 35
            })
        elif gemini_result["is_scam"]:
            category = gemini_result["scam_category"]
            severity = "CRITICAL" if gemini_result["confidence"] > 0.85 else "HIGH"
            if not any(pattern["type"] == category for pattern in detected_patterns):
                detected_patterns.append({
                    "type": category,
                    "source": "model",
                    "severity": severity,
                    "confidence": gemini_result["confidence"],
                    "reason": gemini_result["summary"],
                    "score_delta": gemini_result["score_delta"] or 25
                })

        has_injection = any(pattern["type"] == "PROMPT_INJECTION_ATTEMPT" for pattern in detected_patterns)
        status = "FAILED" if detected_patterns else "PASSED"

        summary_parts = []
        deterministic_count = sum(1 for pattern in detected_patterns if pattern.get("source") == "deterministic")
        if deterministic_count:
            summary_parts.append(f"Deterministic checks: {deterministic_count} indicator(s)")
        if injection_trigger:
            summary_parts.append(f"Deterministic injection boundary: '{injection_trigger}'")
        if vector_match:
            summary_parts.append(f"Vector Match: {vector_match['pattern_name']} ({vector_match['similarity_pct']}%)")
        if gemini_result["is_scam"]:
            summary_parts.append(f"Gemini: {gemini_result['summary']}")

        summary = " | ".join(summary_parts) if summary_parts else "No scam indicator was returned by Gemini or the local semantic matcher."

        return {
            "check_name": "Scam Intent & Language Analysis",
            "status": status,
            "summary": summary,
            "details": {
                "detected_patterns": detected_patterns,
                "score_delta": max((pattern["score_delta"] for pattern in detected_patterns), default=0),
                "is_injection": has_injection,
                "vector_match": vector_match,
                "engine": f"Hybrid (Gemini {gemini_result.get('model_used', 'Flash Lite')} + Local Semantic Matcher)",
                "manipulation_tactics": gemini_result.get("manipulation_tactics", [])
            }
        }

    # 3. Deterministic-only result when optional model analysis is unavailable.

    has_injection = any(p["type"] == "PROMPT_INJECTION_ATTEMPT" for p in detected_patterns)
    total_delta = max((pattern["score_delta"] for pattern in detected_patterns), default=0)

    if has_injection or len(detected_patterns) >= 2 or vector_match:
        status = "FAILED"
        summary = f"Detected {len(detected_patterns)} scam indicators (Heuristic + Vector Match)."
    elif len(detected_patterns) == 1:
        status = "ANOMALOUS"
        summary = f"Suspicious phrasing detected: {detected_patterns[0]['reason']}"
    else:
        status = "PASSED"
        summary = "Natural language scan clear of known scam patterns."

    return {
        "check_name": "Scam Intent & Language Analysis",
        "status": status,
        "summary": summary,
        "details": {
            "detected_patterns": detected_patterns,
            "score_delta": total_delta,
            "is_injection": has_injection,
            "vector_match": vector_match,
            "engine": "Local Semantic Matcher + Heuristics"
        }
    }
