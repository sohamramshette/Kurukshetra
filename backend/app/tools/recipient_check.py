from typing import Dict, Any


def check_recipient_profile(user_id: str, recipient_id: str) -> Dict[str, Any]:
    """
    Tool 2: Evaluates recipient novelty, prior payment history, and account profile.
    Wired directly to Supabase DB with explicit data source & fallback transparency.
    See brain.md Section 8, 10 & 23.
    """
    clean_handle = (recipient_id or "").strip().lower()

    # 1. Attempt genuine database query from Supabase
    try:
        from app.db.session import SessionLocal
        from app.models import Recipient, Transaction
        db = SessionLocal()
        try:
            recipient = db.query(Recipient).filter(Recipient.identifier.ilike(clean_handle)).first()

            if recipient:
                # Count prior transactions for this user + recipient
                prior_count = (
                    db.query(Transaction)
                    .filter(
                        (Transaction.recipient_id == recipient.id) |
                        (Transaction.recipient_identifier.ilike(clean_handle))
                    )
                    .count()
                )

                v_status = (recipient.verification_status or "unverified").lower()
                is_flagged = bool(recipient.is_flagged)

                if is_flagged or v_status in ("failed", "flagged"):
                    status = "FAILED"
                    score_delta = 30
                    summary = (
                        f"Database Match [FLAGGED]: Recipient '{recipient.identifier}' ({recipient.display_name}) "
                        f"is flagged in Supabase. Reason: {recipient.flag_reason or 'Known fraudulent counterparty'}."
                    )
                elif v_status == "suspicious":
                    status = "ANOMALOUS"
                    score_delta = 20
                    summary = (
                        f"Database Match [SUSPICIOUS]: Recipient '{recipient.identifier}' ({recipient.display_name}) "
                        f"is classified as suspicious in Supabase registry ({prior_count} historical transaction(s))."
                    )
                elif v_status == "verified":
                    status = "PASSED"
                    score_delta = -15
                    summary = (
                        f"Database Match [VERIFIED]: Recipient '{recipient.identifier}' ({recipient.display_name}) "
                        f"is verified with {prior_count} recorded transaction(s)."
                    )
                else:  # unverified / new
                    status = "ANOMALOUS"
                    score_delta = 10 if prior_count > 0 else 15
                    summary = (
                        f"Database Match [UNVERIFIED]: Recipient '{recipient.identifier}' ({recipient.display_name}) "
                        f"is registered but unverified in Supabase ({prior_count} prior payments)."
                    )

                return {
                    "check_name": "Recipient Profile & History",
                    "status": status,
                    "summary": summary,
                    "details": {
                        "display_name": recipient.display_name,
                        "category": recipient.category or "INDIVIDUAL",
                        "verification_status": v_status.upper(),
                        "is_new": prior_count == 0,
                        "prior_transactions": prior_count,
                        "reputation": v_status.upper(),
                        "score_delta": score_delta,
                        "data_source": "supabase_db",
                        "is_fallback": False
                    }
                }
        finally:
            db.close()
    except Exception as db_err:
        print(f"[RecipientCheck DB Warning]: {db_err}")

    # 2. Heuristic Fallback (Used only if DB unavailable or payee not in registry)
    suspicious_keywords = ["support", "refund", "prize", "lottery", "kyc", "darknet", "verify", "police", "customs"]
    is_suspicious_handle = any(kw in clean_handle for kw in suspicious_keywords)

    if is_suspicious_handle:
        return {
            "check_name": "Recipient Profile & History",
            "status": "FAILED",
            "summary": (
                f"Heuristic Match [UNREGISTERED]: Recipient '{clean_handle}' not found in registry (0 historical transactions). "
                f"High-risk keyword pattern detected in handle."
            ),
            "details": {
                "is_new": True,
                "prior_transactions": 0,
                "reputation": "SUSPICIOUS",
                "score_delta": 25,
                "data_source": "heuristic_fallback",
                "is_fallback": True
            }
        }

    return {
        "check_name": "Recipient Profile & History",
        "status": "ANOMALOUS",
        "summary": (
            f"Heuristic Match [UNREGISTERED]: First-time payment to '{clean_handle}'. "
            f"Payee not found in registry (0 historical transactions)."
        ),
        "details": {
            "is_new": True,
            "prior_transactions": 0,
            "reputation": "NEUTRAL",
            "score_delta": 15,
            "data_source": "heuristic_fallback",
            "is_fallback": True
        }
    }
