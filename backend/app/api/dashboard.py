"""Persisted, privacy-minimized Guardian metrics for the local judge experience."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.transaction import Transaction
from app.services.payment_service import DEMO_ACTOR_KEY

router = APIRouter()


@router.get("/metrics")
def get_dashboard_metrics(response: Response, db: Session = Depends(get_db)):
    """Return aggregate facts from durable Guardian transaction records.

    The current project has one canonical demo actor rather than authenticated
    tenants, so the scope is fixed server-side and cannot be selected by a
    caller. No recipient, reason, evidence, or transaction identifiers leave
    this aggregate endpoint.
    """
    response.headers["Cache-Control"] = "private, no-store"

    analyzed = and_(
        Transaction.owner_key == DEMO_ACTOR_KEY,
        Transaction.decision.isnot(None),
    )
    threat = or_(
        Transaction.risk_level.in_(["HIGH", "CRITICAL"]),
        Transaction.decision.in_(["HOLD", "BLOCK"]),
    )
    protected_threat = and_(
        threat,
        Transaction.status.in_(["HELD", "BLOCKED", "CANCELLED"]),
    )

    summary = db.query(
        func.count(Transaction.id).label("payments_analyzed"),
        func.sum(case((threat, 1), else_=0)).label("threats_detected"),
        func.sum(case((Transaction.decision == "HOLD", 1), else_=0)).label("payments_held"),
        func.sum(case((Transaction.status == "HELD", 1), else_=0)).label("currently_held"),
        func.sum(case((Transaction.decision == "BLOCK", 1), else_=0)).label("payments_blocked"),
        func.sum(case((Transaction.cancelled_at.isnot(None), 1), else_=0)).label("payments_cancelled"),
        func.sum(case((protected_threat, 1), else_=0)).label("protected_threats"),
    ).filter(analyzed).one()

    payments_analyzed = int(summary.payments_analyzed or 0)
    threats_detected = int(summary.threats_detected or 0)
    protected_threats = int(summary.protected_threats or 0)
    protection_rate = round((protected_threats / threats_detected) * 100, 1) if threats_detected else 0.0

    risk_rows = db.query(
        Transaction.risk_level,
        func.count(Transaction.id),
    ).filter(analyzed).group_by(Transaction.risk_level).all()
    risk_distribution = {level: 0 for level in ("LOW", "MEDIUM", "HIGH", "CRITICAL")}
    for level, count in risk_rows:
        if level in risk_distribution:
            risk_distribution[level] = int(count)

    return {
        "status": "active",
        "source": "persisted_guardian_transactions",
        "scope": DEMO_ACTOR_KEY,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "payments_analyzed": payments_analyzed,
            "threats_detected": threats_detected,
            "payments_held": int(summary.payments_held or 0),
            "currently_held": int(summary.currently_held or 0),
            "payments_blocked": int(summary.payments_blocked or 0),
            "payments_cancelled": int(summary.payments_cancelled or 0),
            "protection_rate_pct": protection_rate,
        },
        "risk_distribution": risk_distribution,
        "definitions": {
            "threats_detected": "HIGH/CRITICAL risk or an original HOLD/BLOCK decision.",
            "payments_held": "Transactions whose original Guardian decision was HOLD.",
            "payments_blocked": "Transactions whose original Guardian decision was BLOCK.",
            "protection_rate_pct": "Threat transactions currently HELD, BLOCKED, or CANCELLED.",
        },
    }
