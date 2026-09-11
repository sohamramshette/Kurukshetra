import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List


class PaymentService:
    """
    Manages pre-payment interception lifecycle and transaction state machine.
    States: INITIATED → ANALYZING → HELD | ALLOWED | STEP_UP | BLOCK → COMPLETED | CANCELLED
    """

    def __init__(self):
        self._payments: Dict[str, Dict[str, Any]] = {}

    def create_pending_payment(self, payment_data: Dict[str, Any]) -> str:
        txn_id = f"txn_{uuid.uuid4().hex[:8]}"
        self._payments[txn_id] = {
            "transaction_id": txn_id,
            "user_id": payment_data.get("user_id", "demo-user"),
            "recipient_id": payment_data.get("recipient_id", ""),
            "amount": float(payment_data.get("amount", 0)),
            "currency": payment_data.get("currency", "INR"),
            "message": payment_data.get("message", ""),
            "payment_type": payment_data.get("payment_type", "UPI"),
            "status": "ANALYZING",
            "created_at": datetime.utcnow().isoformat(),
            "analysis": None
        }
        return txn_id

    def update_analysis(self, txn_id: str, analysis: Dict[str, Any]):
        if txn_id in self._payments:
            self._payments[txn_id]["analysis"] = analysis
            self._payments[txn_id]["status"] = analysis.get("decision", "HELD")

    def get_payment(self, txn_id: str) -> Optional[Dict[str, Any]]:
        return self._payments.get(txn_id)

    def confirm_payment(self, txn_id: str) -> bool:
        if txn_id in self._payments:
            self._payments[txn_id]["status"] = "COMPLETED"
            return True
        return False

    def cancel_payment(self, txn_id: str) -> bool:
        if txn_id in self._payments:
            self._payments[txn_id]["status"] = "CANCELLED"
            return True
        return False

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self._payments.values())


payment_service = PaymentService()
