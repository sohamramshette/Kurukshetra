"""
Guardian API — Security audit, status, and multi-turn coercion detection conversation.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.payment_service import payment_service
from app.services.audit_service import audit_service
from app.services.llm_service import gemini_service

router = APIRouter()

# In-memory conversation store: transaction_id → list of {question, answer} turns
_conversation_store: dict = {}


class ConversationTurnRequest(BaseModel):
    transaction_id: str = Field(..., example="txn_abc12345")
    user_answer: Optional[str] = Field(default=None, example="Yes, someone called me and said to pay immediately.")
    language: Optional[str] = Field(default="en", example="en")


@router.get("/audit/logs")
def get_security_audit_logs():
    """
    Returns the immutable security decision audit trail.
    See brain.md Section 41.
    """
    return {
        "count": len(audit_service.get_logs()),
        "logs": audit_service.get_logs()
    }


@router.get("/{txn_id}")
def get_guardian_status(txn_id: str):
    """
    Returns full Guardian analysis, risk breakdown, verification details, and timeline for a transaction.
    See brain.md Section 22.
    """
    payment = payment_service.get_payment(txn_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    analysis = payment.get("analysis")
    if not analysis:
        raise HTTPException(status_code=404, detail="No Guardian analysis recorded for this transaction.")

    return analysis


@router.post("/converse")
def guardian_converse(payload: ConversationTurnRequest):
    """
    Multi-Turn Guardian Conversation Endpoint.

    Conducts a stateful protective interview with the user to detect coercion,
    third-party pressure, or social engineering in progress — AFTER a HOLD/WARN decision.

    Flow:
    1. First call (no user_answer): Guardian generates the first probing question.
    2. Subsequent calls (with user_answer): Records answer, generates next question.
    3. Final call (is_final=True in response): Runs coercion evaluation and returns updated decision.

    See brain.md Section 12 & 40.
    """
    txn_id = payload.transaction_id
    payment = payment_service.get_payment(txn_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    analysis = payment.get("analysis")
    if not analysis:
        raise HTTPException(status_code=404, detail="No Guardian analysis for this transaction.")

    decision = analysis.get("decision", "HOLD")
    # Only allow conversation for non-BLOCK decisions
    if decision == "BLOCK":
        return {
            "transaction_id": txn_id,
            "decision": "BLOCK",
            "conversation_active": False,
            "message": "Payment permanently blocked due to detected prompt injection. No conversation possible.",
            "coercion_assessment": None
        }

    signals = analysis.get("signals", [])
    recipient_id = payment.get("recipient_id", "")
    amount = float(payment.get("amount", 0))

    # Initialize conversation if this is the first call
    if txn_id not in _conversation_store:
        _conversation_store[txn_id] = []

    history = _conversation_store[txn_id]

    # Record the user's answer to the previous question (if any)
    if payload.user_answer and history:
        last_entry = history[-1]
        if "answer" not in last_entry:
            last_entry["answer"] = payload.user_answer

    # Generate next question
    lang = payload.language or "en"
    next_q = gemini_service.generate_conversation_question(
        transaction_id=txn_id,
        recipient_id=recipient_id,
        amount=amount,
        decision=decision,
        signals=signals,
        conversation_history=[h for h in history if "answer" in h],
        language=lang
    )

    # Add question to history (answer will be added on next call)
    history.append({"question": next_q["question"]})

    # If conversation is complete, run coercion evaluation
    if next_q.get("is_final") or len([h for h in history if "answer" in h]) >= 2:
        completed_turns = [h for h in history if "answer" in h]

        coercion_result = gemini_service.evaluate_coercion(
            conversation_history=completed_turns,
            signals=signals,
            recipient_id=recipient_id,
            language=lang
        )

        # Log coercion result in audit
        audit_service.record_decision(
            transaction_id=txn_id,
            action=f"COERCION_EVAL:{coercion_result.get('updated_decision', 'HOLD')}",
            risk_score=analysis.get("risk_score", 0),
            reason=coercion_result.get("assessment", ""),
            signals_count=len(coercion_result.get("coercion_indicators", []))
        )

        return {
            "transaction_id": txn_id,
            "conversation_active": False,
            "conversation_complete": True,
            "turns_completed": len(completed_turns),
            "question": next_q["question"],
            "question_type": next_q["question_type"],
            "coercion_assessment": {
                "coercion_detected": coercion_result["coercion_detected"],
                "confidence": coercion_result["confidence"],
                "updated_decision": coercion_result["updated_decision"],
                "coercion_indicators": coercion_result.get("coercion_indicators", []),
                "assessment": coercion_result["assessment"]
            }
        }

    return {
        "transaction_id": txn_id,
        "conversation_active": True,
        "conversation_complete": False,
        "turns_completed": len([h for h in history if "answer" in h]),
        "question": next_q["question"],
        "question_type": next_q["question_type"],
        "is_final_question": next_q.get("is_final", False),
        "coercion_assessment": None
    }
