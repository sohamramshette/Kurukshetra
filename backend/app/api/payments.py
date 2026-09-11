import uuid
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.guardian.agent import guardian_agent
from app.services.payment_service import GUIDANCE_TEXT_VERSION, PaymentLifecycleError, payment_service

router = APIRouter()


class PaymentAnalyzeRequest(BaseModel):
    # Retained for request compatibility. The server deliberately uses its
    # canonical demo actor and does not trust this caller-provided identity.
    user_id: Optional[str] = Field(default="aarav", example="aarav")
    recipient_id: Optional[str] = Field(default=None, example="support-verify@demo")
    recipient: Optional[str] = Field(default=None, example="support-verify@demo")
    amount: float = Field(..., gt=0, example=25000.0)
    currency: str = Field(default="INR", min_length=3, max_length=10, example="INR")
    message: Optional[str] = Field(default="", max_length=1000)
    reason: Optional[str] = Field(default=None, max_length=1000)
    payment_type: str = Field(default="UPI", min_length=2, max_length=30)

    def get_recipient(self) -> str:
        return (self.recipient_id or self.recipient or "").strip()

    def get_message(self) -> str:
        return (self.message or self.reason or "").strip()


class ActionRequest(BaseModel):
    expected_version: int = Field(..., ge=1)
    idempotency_key: str = Field(..., min_length=16, max_length=128)


class GuidanceAcknowledgement(ActionRequest):
    kind: Literal["INDEPENDENT_GUIDANCE_ACK"]
    text_version: Literal["independent-contact-v1"]
    affirmed: Literal[True]


def _raise_lifecycle_error(error: PaymentLifecycleError) -> None:
    raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.detail}) from error


@router.post("/analyze", status_code=status.HTTP_200_OK)
def analyze_payment(
    payload: PaymentAnalyzeRequest,
    x_guardian_analysis_key: Optional[str] = Header(default=None),
):
    """Analyze once or recover the same durable pre-payment decision."""
    recipient_id = payload.get_recipient()
    message = payload.get_message()
    if not recipient_id or not message:
        raise HTTPException(status_code=422, detail="Recipient and payment reason are required for Guardian analysis.")
    if x_guardian_analysis_key and not 16 <= len(x_guardian_analysis_key) <= 128:
        raise HTTPException(status_code=422, detail="Guardian analysis key must be between 16 and 128 characters.")

    payment_dict: Dict[str, Any] = {
        "user_id": "aarav",  # Server-owned demo actor; caller input is intentionally ignored.
        "recipient_id": recipient_id,
        "amount": payload.amount,
        "currency": payload.currency.upper(),
        "message": message,
        "payment_type": payload.payment_type.upper(),
    }
    analysis_key = x_guardian_analysis_key or uuid.uuid4().hex
    transaction_id: Optional[str] = None

    try:
        replayed = payment_service.replay_analysis(x_guardian_analysis_key)
        if replayed:
            return replayed
        transaction_id = payment_service.create_pending_payment(payment_dict, analysis_key)
        analysis = guardian_agent.analyze(payment_dict, transaction_id=transaction_id)
        return payment_service.persist_analysis(transaction_id, analysis)
    except PaymentLifecycleError as error:
        if transaction_id:
            payment_service.discard_pending_payment(transaction_id)
        _raise_lifecycle_error(error)
    except Exception as error:
        if transaction_id:
            payment_service.discard_pending_payment(transaction_id)
        raise HTTPException(
            status_code=503,
            detail={"code": "ANALYSIS_UNAVAILABLE", "message": "Guardian security check could not be completed. The payment remains paused."},
        ) from error


@router.post("/{txn_id}/acknowledge-guidance", status_code=status.HTTP_200_OK)
def acknowledge_guidance(
    txn_id: str,
    action_data: GuidanceAcknowledgement,
    x_guardian_action_token: Optional[str] = Header(default=None),
):
    """Record a user attestation to independent-contact guidance; no external verification is claimed."""
    try:
        return payment_service.acknowledge_guidance(
            txn_id,
            x_guardian_action_token,
            action_data.expected_version,
            action_data.idempotency_key,
            {
                "kind": action_data.kind,
                "text_version": action_data.text_version,
                "affirmed": action_data.affirmed,
                "guidance_text_version": GUIDANCE_TEXT_VERSION,
            },
        )
    except PaymentLifecycleError as error:
        _raise_lifecycle_error(error)


@router.post("/{txn_id}/confirm", status_code=status.HTTP_200_OK)
def confirm_payment(
    txn_id: str,
    action_data: ActionRequest,
    x_guardian_action_token: Optional[str] = Header(default=None),
):
    """Explicitly confirm only a server-policy-permitted, version-matched transaction."""
    try:
        return payment_service.confirm_payment(
            txn_id, x_guardian_action_token, action_data.expected_version, action_data.idempotency_key
        )
    except PaymentLifecycleError as error:
        _raise_lifecycle_error(error)


@router.post("/{txn_id}/cancel", status_code=status.HTTP_200_OK)
def cancel_payment(
    txn_id: str,
    action_data: ActionRequest,
    x_guardian_action_token: Optional[str] = Header(default=None),
):
    """Explicitly cancel a non-completed transaction through the durable lifecycle."""
    try:
        return payment_service.cancel_payment(
            txn_id, x_guardian_action_token, action_data.expected_version, action_data.idempotency_key
        )
    except PaymentLifecycleError as error:
        _raise_lifecycle_error(error)
