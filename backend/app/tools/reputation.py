from typing import Dict, Any


def check_recipient_reputation(recipient_id: str) -> Dict[str, Any]:
    """
    Tool 3: Checks community dispute intelligence and fraud database reports.
    Wired directly to Supabase DB with explicit data source & fallback transparency.
    See brain.md Section 8, 23 & 32.
    """
    clean_handle = (recipient_id or "").strip().lower()

    # 1. Attempt genuine database query from Supabase
    try:
        from app.db.session import SessionLocal
        from app.models import Recipient
        db = SessionLocal()
        try:
            recipient = db.query(Recipient).filter(Recipient.identifier.ilike(clean_handle)).first()

            if recipient:
                rep_score = float(recipient.reputation_score or 50.0)
                is_flagged = bool(recipient.is_flagged)
                v_status = (recipient.verification_status or "unverified").lower()

                if is_flagged or rep_score <= 15.0 or v_status in ("failed", "flagged"):
                    status = "FAILED"
                    score_delta = 25
                    summary = (
                        f"Database Match [HIGH RISK]: Recipient '{recipient.identifier}' has a critical reputation score "
                        f"of {rep_score:.1f}/100 in Supabase registry. Status: {v_status.upper()}."
                    )
                elif rep_score < 70.0 or v_status == "suspicious":
                    status = "ANOMALOUS"
                    score_delta = 15
                    summary = (
                        f"Database Match [MODERATE RISK]: Recipient '{recipient.identifier}' has a below-average reputation "
                        f"score of {rep_score:.1f}/100 in Supabase threat registry."
                    )
                else:
                    status = "PASSED"
                    score_delta = -5
                    summary = (
                        f"Database Match [CLEAR]: Recipient '{recipient.identifier}' has a high trust score "
                        f"of {rep_score:.1f}/100 in collective registry."
                    )

                return {
                    "check_name": "Collective Intelligence & Reputation",
                    "status": status,
                    "summary": summary,
                    "details": {
                        "reputation_score": rep_score,
                        "verification_status": v_status.upper(),
                        "is_flagged": is_flagged,
                        "flag_reason": recipient.flag_reason,
                        "score_delta": score_delta,
                        "data_source": "supabase_db",
                        "is_fallback": False
                    }
                }
        finally:
            db.close()
    except Exception as db_err:
        print(f"[Reputation DB Warning]: {db_err}")

    # 2. Heuristic Fallback (Used only if DB is unavailable or handle not in registry)
    flagged_handles = {
        "support-verify@demo": 4,
        "refund-desk@demo": 7,
        "prize-desk@demo": 12,
        "attacker@darknet": 19
    }

    reports = flagged_handles.get(clean_handle, 0)

    if reports > 0:
        rep_score = max(5.0, 100.0 - (reports * 15.0))
        return {
            "check_name": "Collective Intelligence & Reputation",
            "status": "FAILED",
            "summary": (
                f"Heuristic Match [COMMUNITY DISPUTE]: Recipient '{clean_handle}' has {reports} "
                f"independent dispute reports in threat cache."
            ),
            "details": {
                "active_disputes": reports,
                "reputation_score": rep_score,
                "score_delta": 25,
                "data_source": "heuristic_fallback",
                "is_fallback": True
            }
        }

    return {
        "check_name": "Collective Intelligence & Reputation",
        "status": "PASSED",
        "summary": "Heuristic Match [UNREGISTERED]: 0 known dispute reports in threat cache. Baseline neutral reputation applied.",
        "details": {
            "active_disputes": 0,
            "reputation_score": 75.0,
            "score_delta": 0,
            "data_source": "heuristic_fallback",
            "is_fallback": True
        }
    }
