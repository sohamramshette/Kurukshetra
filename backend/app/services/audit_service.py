from datetime import datetime
from typing import List, Dict, Any


class AuditService:
    """
    Immutable audit logging service for all Guardian pre-payment interception events.
    See brain.md Section 41.
    """

    def __init__(self):
        self._logs: List[Dict[str, Any]] = []

    def record_decision(
        self,
        transaction_id: str,
        action: str,
        risk_score: int,
        reason: str,
        signals_count: int = 0
    ):
        entry = {
            "id": f"audit_{len(self._logs) + 1:04d}",
            "timestamp": datetime.utcnow().isoformat(),
            "transaction_id": transaction_id,
            "action": action,
            "risk_score": risk_score,
            "signals_detected": signals_count,
            "reason": reason
        }
        self._logs.append(entry)

    def get_logs(self) -> List[Dict[str, Any]]:
        return self._logs


audit_service = AuditService()
