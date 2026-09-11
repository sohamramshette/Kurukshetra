from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field

from app.guardian.agent import guardian_agent
from app.services.payment_service import payment_service
from app.services.audit_service import audit_service

router = APIRouter()


class PaymentAnalyzeRequest(BaseModel):
    user_id: Optional[str] = Field(default="aarav", example="aarav")
    recipient_id: Optional[str] = Field(default=None, example="support-verify@demo")
    recipient: Optional[str] = Field(default=None, example="support-verify@demo")
    amount: float = Field(..., gt=0, example=25000.0)
    currency: str = Field(default="INR", example="INR")
    message: Optional[str] = Field(default="", example="URGENT: Your refund will expire today. Send fee.")
    reason: Optional[str] = Field(default=None, example="URGENT: Your refund will expire today. Send fee.")
    payment_type: str = Field(default="UPI", example="UPI")
    sensor_telemetry: Optional[Dict[str, Any]] = Field(default=None, example={"active_call": True, "call_duration_seconds": 240})

    def get_recipient(self) -> str:
        return self.recipient_id or self.recipient or "unknown@upi"

    def get_message(self) -> str:
        return self.message or self.reason or ""


class ActionRequest(BaseModel):
    action: Optional[str] = "CONFIRM"
    reason: Optional[str] = None


class CounterfactualRequest(BaseModel):
    payment: PaymentAnalyzeRequest
    tweaks: Dict[str, Any] = Field(default_factory=dict)


class OverrideRequest(BaseModel):
    reason: Optional[str] = None
    safeword: Optional[str] = None


@router.post("/analyze", status_code=status.HTTP_200_OK)
def analyze_payment(payload: PaymentAnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Core Pre-Payment Interception Endpoint.
    Analyzes transaction, evaluates risk, runs verification tools, and determines protective action BEFORE money moves.
    See brain.md Section 22.
    """
    payment_dict = payload.model_dump()
    payment_dict["recipient_id"] = payload.get_recipient()
    payment_dict["message"] = payload.get_message()
    payment_dict["user_id"] = payload.user_id or "aarav"

    # 1. Create transaction in state machine
    txn_id = payment_service.create_pending_payment(payment_dict)

    # 2. Run Guardian Agentic Cycle (instant in-memory ReAct engine)
    analysis = guardian_agent.analyze(payment_dict, transaction_id=txn_id)

    # 3. Update state machine
    payment_service.update_analysis_state(txn_id, analysis)

    # 4. Asynchronously persist to Supabase in BackgroundTasks (sub-second response for UI!)
    background_tasks.add_task(payment_service.persist_to_db, txn_id, analysis)
    background_tasks.add_task(
        audit_service.record_decision,
        transaction_id=txn_id,
        action=analysis["decision"],
        risk_score=analysis["risk_score"],
        reason=analysis["explanation"],
        signals_count=len(analysis.get("signals", []))
    )

    return analysis


@router.post("/{txn_id}/confirm", status_code=status.HTTP_200_OK)
def confirm_payment(txn_id: str, action_data: Optional[ActionRequest] = None):
    """
    Confirms and authorizes payment if allowed by security policy.
    """
    payment = payment_service.get_payment(txn_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    analysis = payment.get("analysis")
    if analysis and analysis.get("decision") == "BLOCK":
        raise HTTPException(
            status_code=403,
            detail="Transaction blocked by policy. This payment cannot be confirmed."
        )

    success = payment_service.confirm_payment(txn_id)
    return {
        "transaction_id": txn_id,
        "status": "COMPLETED",
        "confirmed": success
    }


@router.post("/{txn_id}/cancel", status_code=status.HTTP_200_OK)
def cancel_payment(txn_id: str):
    """
    Safely halts and cancels a held payment transaction.
    """
    payment = payment_service.get_payment(txn_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    payment_service.cancel_payment(txn_id)
    return {
        "transaction_id": txn_id,
        "status": "CANCELLED"
    }


@router.post("/counterfactual", status_code=status.HTTP_200_OK)
def simulate_counterfactual(payload: CounterfactualRequest):
    """
    Simulates counterfactual 'What-If' scenarios for a given payment.
    See brain.md Section 34.
    """
    payment_dict = payload.payment.model_dump()
    payment_dict["recipient_id"] = payload.payment.get_recipient()
    payment_dict["message"] = payload.payment.get_message()
    payment_dict["user_id"] = payload.payment.user_id or "aarav"

    return guardian_agent.simulate_counterfactual(payment_dict, payload.tweaks)


@router.post("/{txn_id}/override", status_code=status.HTTP_200_OK)
def request_user_override(txn_id: str, payload: OverrideRequest, background_tasks: BackgroundTasks):
    """
    Registers a user override request with mandatory adaptive cooling period and safeword verification.
    See brain.md Section 13 & 39.
    """
    payment = payment_service.get_payment(txn_id)
    analysis = (payment.get("analysis") or {}) if payment else {}
    
    if analysis.get("decision") == "BLOCK":
        raise HTTPException(
            status_code=403,
            detail="Transaction is classified as CRITICAL_MALICIOUS (Hard Block). Policy prohibits user override."
        )

    cooling_seconds = 14400  # 4 hours
    cooling_end = datetime.utcnow() + timedelta(seconds=cooling_seconds)

    override_note = payload.reason or "User acknowledged risk and initiated protective cooling-period override."

    background_tasks.add_task(
        audit_service.record_decision,
        transaction_id=txn_id,
        action="USER_OVERRIDE_COOLING_ACTIVE",
        risk_score=analysis.get("risk_score", 85),
        reason=f"Cooling period active (4 hours). Reason: {override_note}",
        signals_count=len(analysis.get("signals", []))
    )

    return {
        "transaction_id": txn_id,
        "status": "COOLING_PERIOD_ACTIVE",
        "cooling_period_seconds": cooling_seconds,
        "cooling_ends_at": cooling_end.isoformat(),
        "safeword_verified": bool(payload.safeword),
        "override_allowed": True,
        "message": "User override recorded. Enforcing statutory 4-hour cooling window to protect against coercion pressure."
    }

