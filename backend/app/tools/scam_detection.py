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
    Multi-Layer Intelligence:
    1. Semantic Vector RAG: Cosine similarity against 20+ verified fraud templates.
    2. Google Gemini Flash Lite: Real-time psychological manipulation reasoning.
    3. Deterministic Heuristics: Zero-latency fail-safe fallback.
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

    # 1. Semantic Vector Similarity (RAG against known scam templates)
    vector_match = vector_service.match_scam_pattern(message)
    if vector_match:
        detected_patterns.append({
            "type": "SEMANTIC_SCAM_VECTOR_MATCH",
            "severity": "CRITICAL" if vector_match["similarity_pct"] >= 65 else "HIGH",
            "confidence": vector_match["similarity_score"],
            "reason": f"Semantic RAG matched '{vector_match['pattern_name']}' ({vector_match['similarity_pct']}% similarity).",
            "score_delta": vector_match["score_delta"],
            "reference_sample": vector_match["reference_sample"]
        })

    # 2. Try Gemini Flash Lite analysis (if configured)
    gemini_result = gemini_service.analyze_scam_intent(message, recipient_id, amount)

    if gemini_result is not None:
        if gemini_result["is_injection_attempt"] or gemini_result["scam_category"] == "PROMPT_INJECTION":
            detected_patterns.append({
                "type": "PROMPT_INJECTION_ATTEMPT",
                "severity": "CRITICAL",
                "confidence": gemini_result["confidence"],
                "reason": gemini_result["summary"] or "Adversarial prompt injection attempt detected by Gemini.",
                "score_delta": 35
            })
        elif gemini_result["is_scam"]:
            category = gemini_result["scam_category"]
            severity = "CRITICAL" if gemini_result["confidence"] > 0.85 else "HIGH"
            detected_patterns.append({
                "type": category,
                "severity": severity,
                "confidence": gemini_result["confidence"],
                "reason": gemini_result["summary"],
                "score_delta": gemini_result["score_delta"] or 25
            })

        has_injection = gemini_result["is_injection_attempt"]
        status = "FAILED" if detected_patterns else "PASSED"

        summary_parts = []
        if vector_match:
            summary_parts.append(f"Vector Match: {vector_match['pattern_name']} ({vector_match['similarity_pct']}%)")
        if gemini_result["is_scam"]:
            summary_parts.append(f"Gemini: {gemini_result['summary']}")

        summary = " | ".join(summary_parts) if summary_parts else "Verified clear by Gemini Flash Lite and Vector RAG."

        return {
            "check_name": "Scam Intent & Language Analysis",
            "status": status,
            "summary": summary,
            "details": {
                "detected_patterns": detected_patterns,
                "score_delta": sum(p["score_delta"] for p in detected_patterns),
                "is_injection": has_injection,
                "vector_match": vector_match,
                "engine": f"Hybrid (Gemini {gemini_result.get('model_used', 'Flash Lite')} + Semantic Vector RAG)",
                "manipulation_tactics": gemini_result.get("manipulation_tactics", [])
            }
        }

    # 3. Deterministic Heuristic Fallback (Fail-Safe per brain.md Section 37)
    lower = message.lower()

    for trigger in SCAM_SIGNALS["PROMPT_INJECTION"]:
        if trigger in lower:
            detected_patterns.append({
                "type": "PROMPT_INJECTION_ATTEMPT",
                "severity": "CRITICAL",
                "confidence": 0.99,
                "reason": f"Adversarial instruction injection detected: '{trigger}'.",
                "score_delta": 35
            })
            break

    for trigger in SCAM_SIGNALS["URGENCY"]:
        if trigger in lower:
            detected_patterns.append({
                "type": "URGENCY_PRESSURE",
                "severity": "HIGH",
                "confidence": 0.92,
                "reason": f"Artificial urgency phrase detected: '{trigger}'.",
                "score_delta": 20
            })
            break

    for trigger in SCAM_SIGNALS["AUTHORITY"]:
        if trigger in lower:
            detected_patterns.append({
                "type": "AUTHORITY_IMPERSONATION",
                "severity": "HIGH",
                "confidence": 0.89,
                "reason": f"Sender claims official authority: '{trigger}'.",
                "score_delta": 25
            })
            break

    for trigger in SCAM_SIGNALS["REFUND_OR_PRIZE"]:
        if trigger in lower:
            detected_patterns.append({
                "type": "REFUND_PRIZE_BAIT",
                "severity": "HIGH",
                "confidence": 0.91,
                "reason": f"Advance-fee bait pattern detected: '{trigger}'.",
                "score_delta": 25
            })
            break

    has_injection = any(p["type"] == "PROMPT_INJECTION_ATTEMPT" for p in detected_patterns)
    total_delta = sum(p["score_delta"] for p in detected_patterns)

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
            "engine": "Semantic Vector RAG + Heuristics"
        }
    }
