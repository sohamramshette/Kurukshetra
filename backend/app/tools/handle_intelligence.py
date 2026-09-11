from typing import Dict, Any
from app.services.llm_service import gemini_service

# Fallback heuristic: known brand keywords in handles
BRAND_KEYWORDS = {
    "sbi": "State Bank of India",
    "hdfc": "HDFC Bank",
    "icici": "ICICI Bank",
    "axis": "Axis Bank",
    "paytm": "Paytm",
    "uidai": "UIDAI / Aadhaar",
    "nhai": "NHAI / FASTag",
    "irctc": "IRCTC",
    "income.tax": "Income Tax Department",
    "incometax": "Income Tax Department",
    "amazon": "Amazon",
    "flipkart": "Flipkart",
    "google": "Google",
}

SUSPICIOUS_ROLE_KEYWORDS = [
    "support", "refund", "kyc", "verify", "verification",
    "prize", "lottery", "helpdesk", "care", "officer",
    "reward", "claim", "settlement"
]


def analyze_recipient_handle(recipient_id: str, amount: float) -> Dict[str, Any]:
    """
    Tool 7: Gemini-powered UPI handle intelligence.
    Detects brand impersonation, suspicious role keywords, and lookalike attacks
    directly in the recipient handle string — a threat vector unique to UPI fraud.
    See brain.md Section 8 & 37.
    """
    check_name = "Recipient Handle Intelligence"
    lower = recipient_id.lower()

    # 1. Try Gemini handle intelligence (richest analysis)
    gemini_result = gemini_service.analyze_recipient_handle(recipient_id, amount)

    if gemini_result is not None:
        is_threat = (
            gemini_result["brand_impersonation_detected"]
            or gemini_result["lookalike_detected"]
            or gemini_result["domain_mismatch"]
            or len(gemini_result["suspicious_keywords"]) >= 2
        )
        status = "FAILED" if is_threat else "PASSED"
        score_delta = gemini_result["score_delta"] if is_threat else -5

        return {
            "check_name": check_name,
            "status": status,
            "summary": gemini_result["threat_summary"] or f"Handle '{recipient_id}' analyzed by Gemini.",
            "details": {
                "brand_impersonation_detected": gemini_result["brand_impersonation_detected"],
                "impersonated_brand": gemini_result["impersonated_brand"],
                "suspicious_keywords": gemini_result["suspicious_keywords"],
                "lookalike_detected": gemini_result["lookalike_detected"],
                "domain_mismatch": gemini_result["domain_mismatch"],
                "confidence": gemini_result["confidence"],
                "engine": "Gemini Flash Lite",
                "score_delta": score_delta
            }
        }

    # 2. Deterministic fallback heuristic
    impersonated_brand = None
    for kw, brand in BRAND_KEYWORDS.items():
        if kw in lower:
            impersonated_brand = brand
            break

    role_hits = [kw for kw in SUSPICIOUS_ROLE_KEYWORDS if kw in lower]
    brand_hit = impersonated_brand is not None

    if brand_hit and role_hits:
        return {
            "check_name": check_name,
            "status": "FAILED",
            "summary": f"Handle '{recipient_id}' mimics '{impersonated_brand}' with suspicious role keywords {role_hits}.",
            "details": {
                "brand_impersonation_detected": True,
                "impersonated_brand": impersonated_brand,
                "suspicious_keywords": role_hits,
                "engine": "Heuristic",
                "score_delta": 25
            }
        }

    if brand_hit:
        return {
            "check_name": check_name,
            "status": "ANOMALOUS",
            "summary": f"Handle '{recipient_id}' contains brand keyword suggesting '{impersonated_brand}'. Verify independently.",
            "details": {
                "brand_impersonation_detected": True,
                "impersonated_brand": impersonated_brand,
                "suspicious_keywords": role_hits,
                "engine": "Heuristic",
                "score_delta": 15
            }
        }

    if len(role_hits) >= 2:
        return {
            "check_name": check_name,
            "status": "ANOMALOUS",
            "summary": f"Handle '{recipient_id}' contains multiple suspicious role keywords: {role_hits}.",
            "details": {
                "brand_impersonation_detected": False,
                "suspicious_keywords": role_hits,
                "engine": "Heuristic",
                "score_delta": 10
            }
        }

    return {
        "check_name": check_name,
        "status": "PASSED",
        "summary": f"Handle '{recipient_id}' shows no impersonation or brand-spoofing indicators.",
        "details": {
            "brand_impersonation_detected": False,
            "suspicious_keywords": [],
            "engine": "Heuristic",
            "score_delta": 0
        }
    }
