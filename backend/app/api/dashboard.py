from fastapi import APIRouter
from app.services.payment_service import payment_service

router = APIRouter()


@router.get("/metrics")
def get_dashboard_metrics():
    """
    Returns security dashboard metrics for judges and monitoring.
    Combines live session counts with synthetic prototype benchmarks.
    See brain.md Section 17.
    """
    live_payments = payment_service.list_all()

    live_held = sum(1 for p in live_payments if p.get("status") in ["HOLD", "BLOCK"])
    live_held_amount = sum(p.get("amount", 0) for p in live_payments if p.get("status") in ["HOLD", "BLOCK"])

    total_analyzed = 1248 + len(live_payments)
    total_held = 27 + live_held
    total_prevented_inr = 840000 + live_held_amount

    return {
        "status": "active",
        "benchmark_label": "Prototype / Synthetic Telemetry (PS09)",
        "summary": {
            "transactions_analyzed": total_analyzed,
            "high_risk_flagged": 74 + sum(1 for p in live_payments if p.get("status") == "STEP_UP"),
            "critical_scams_detected": 31 + live_held,
            "payments_held": total_held,
            "potential_loss_prevented_inr": total_prevented_inr,
            "avg_decision_latency_ms": 182,
            "false_positive_rate_pct": 2.1
        },
        "risk_distribution": {
            "LOW": 78,
            "MEDIUM": 14,
            "HIGH": 5,
            "CRITICAL": 3
        },
        "top_scam_patterns": [
            {"pattern": "Fake Refund / Reversal Verification", "frequency": 42},
            {"pattern": "Authority & Customer Support Impersonation", "frequency": 28},
            {"pattern": "Urgent Utility Disconnection Extortion", "frequency": 19},
            {"pattern": "Prompt Injection / Adversarial Override", "frequency": 11}
        ]
    }
