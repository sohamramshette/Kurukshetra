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
    impersonated_brand = next((brand for keyword, brand in BRAND_KEYWORDS.items() if keyword in lower), None)
    role_hits = [keyword for keyword in SUSPICIOUS_ROLE_KEYWORDS if keyword in lower]
    brand_hit = impersonated_brand is not None
    deterministic_delta = 25 if brand_hit and role_hits else 15 if brand_hit else 10 if len(role_hits) >= 2 else 0

    # Optional model analysis may enrich but cannot suppress deterministic handle evidence.
    gemini_result = gemini_service.analyze_recipient_handle(recipient_id, amount)

    if gemini_result is not None:
        is_threat = (
            gemini_result["brand_impersonation_detected"]
            or gemini_result["lookalike_detected"]
            or gemini_result["domain_mismatch"]
            or len(gemini_result["suspicious_keywords"]) >= 2
            or brand_hit
            or len(role_hits) >= 2
        )
        status = "FAILED" if is_threat else "PASSED"
        score_delta = max(gemini_result["score_delta"], deterministic_delta) if is_threat else 0
        combined_keywords = sorted(set(gemini_result["suspicious_keywords"] + role_hits))

        deterministic_summary = None
        if brand_hit and role_hits:
            deterministic_summary = f"Handle '{recipient_id}' combines the '{impersonated_brand}' brand keyword with suspicious role keywords {role_hits}."
        elif brand_hit:
            deterministic_summary = f"Handle '{recipient_id}' contains the '{impersonated_brand}' brand keyword. Verify independently."
        elif len(role_hits) >= 2:
            deterministic_summary = f"Handle '{recipient_id}' contains multiple suspicious role keywords: {role_hits}."

        return {
            "check_name": check_name,
            "status": status,
            "summary": deterministic_summary or gemini_result["threat_summary"] or f"Handle '{recipient_id}' shows no recognized impersonation indicator.",
            "details": {
                "brand_impersonation_detected": gemini_result["brand_impersonation_detected"] or brand_hit,
                "impersonated_brand": gemini_result["impersonated_brand"] or impersonated_brand,
                "suspicious_keywords": combined_keywords,
                "lookalike_detected": gemini_result["lookalike_detected"],
                "domain_mismatch": gemini_result["domain_mismatch"],
                "confidence": gemini_result["confidence"],
                "engine": "Gemini Flash Lite",
                "score_delta": score_delta
            }
        }

    # Deterministic fallback heuristic
    # (values were computed before optional model analysis so they always run).

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
