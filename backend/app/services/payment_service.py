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

    def update_analysis_state(self, txn_id: str, analysis: Dict[str, Any]):
        if txn_id in self._payments:
            self._payments[txn_id]["analysis"] = analysis
            self._payments[txn_id]["status"] = analysis.get("decision", "HELD")

    def persist_to_db(self, txn_id: str, analysis: Dict[str, Any]):
        if txn_id not in self._payments:
            return
        # Persist to Supabase Database
        try:
            from app.db.session import SessionLocal
            from app.models import User, Recipient, Transaction, GuardianDecision, RiskEvent, VerificationCheck
            db = SessionLocal()
            try:
                # Resolve User (Aarav Mehta)
                user = db.query(User).filter(User.name.ilike("%Aarav%")).first()
                if not user:
                    user = db.query(User).first()
                user_id = user.id if user else None

                # Resolve Recipient
                recip_identifier = self._payments[txn_id].get("recipient_id", "")
                recip = db.query(Recipient).filter(Recipient.identifier == recip_identifier).first()
                if not recip:
                    recip = db.query(Recipient).first()
                recip_id = recip.id if recip else None

                db_txn_id = uuid.uuid4()
                txn_record = Transaction(
                    id=db_txn_id,
                    user_id=user_id,
                    recipient_id=recip_id,
                    recipient_identifier=recip_identifier,
                    amount=self._payments[txn_id]["amount"],
                    currency=self._payments[txn_id]["currency"],
                    payment_type=self._payments[txn_id]["payment_type"],
                    status=analysis.get("decision", "HELD"),
                    reason=self._payments[txn_id].get("message", ""),
                    risk_score=analysis.get("risk_score", 0),
                    risk_level=analysis.get("risk_level", "LOW"),
                    decision=analysis.get("decision", "ALLOW"),
                    analysis_json=analysis,
                    timestamp=datetime.utcnow()
                )
                db.add(txn_record)

                decision_record = GuardianDecision(
                    id=uuid.uuid4(),
                    transaction_id=db_txn_id,
                    risk_score=analysis.get("risk_score", 0),
                    risk_level=analysis.get("risk_level", "LOW"),
                    action=analysis.get("decision", "ALLOW"),
                    reason=analysis.get("explanation", ""),
                    intervention_ui_mode=analysis.get("intervention", {}).get("ui_mode"),
                    counterfactual=analysis.get("counterfactual"),
                    cooling_period_seconds=analysis.get("intervention", {}).get("cooling_period_seconds", 0),
                    created_at=datetime.utcnow()
                )
                db.add(decision_record)

                for sig in analysis.get("signals", []):
                    db.add(RiskEvent(
                        id=uuid.uuid4(),
                        transaction_id=db_txn_id,
                        signal_type=sig.get("type", "UNKNOWN"),
                        severity=sig.get("severity", "LOW"),
                        score_delta=sig.get("score_delta", 0),
                        evidence=sig,
                        created_at=datetime.utcnow()
                    ))

                for chk_name, chk in analysis.get("verification", {}).items():
                    if isinstance(chk, dict):
                        db.add(VerificationCheck(
                            id=uuid.uuid4(),
                            transaction_id=db_txn_id,
                            check_type=chk_name,
                            status=chk.get("status", "PASSED"),
                            result=chk.get("summary", ""),
                            evidence=chk.get("details"),
                            created_at=datetime.utcnow()
                        ))

                db.commit()
                self._payments[txn_id]["db_txn_id"] = str(db_txn_id)
            except Exception as e:
                db.rollback()
                print(f"[Supabase Persistence Warning]: {e}")
            finally:
                db.close()
        except Exception as outer_e:
            print(f"[Supabase Session Warning]: {outer_e}")

    def update_analysis(self, txn_id: str, analysis: Dict[str, Any]):
        self.update_analysis_state(txn_id, analysis)
        self.persist_to_db(txn_id, analysis)

    def get_payment(self, txn_id: str) -> Optional[Dict[str, Any]]:
        return self._payments.get(txn_id)

    def confirm_payment(self, txn_id: str) -> bool:
        if txn_id in self._payments:
            self._payments[txn_id]["status"] = "COMPLETED"
            try:
                db_id = self._payments[txn_id].get("db_txn_id")
                if db_id:
                    from app.db.session import SessionLocal
                    from app.models import Transaction
                    db = SessionLocal()
                    db_txn = db.query(Transaction).filter(Transaction.id == uuid.UUID(db_id)).first()
                    if db_txn:
                        db_txn.status = "COMPLETED"
                        db.commit()
                    db.close()
            except Exception as e:
                print(f"[Supabase Confirm Warning]: {e}")
            return True
        return False

    def cancel_payment(self, txn_id: str) -> bool:
        if txn_id in self._payments:
            self._payments[txn_id]["status"] = "CANCELLED"
            try:
                db_id = self._payments[txn_id].get("db_txn_id")
                if db_id:
                    from app.db.session import SessionLocal
                    from app.models import Transaction
                    db = SessionLocal()
                    db_txn = db.query(Transaction).filter(Transaction.id == uuid.UUID(db_id)).first()
                    if db_txn:
                        db_txn.status = "CANCELLED"
                        db.commit()
                    db.close()
            except Exception as e:
                print(f"[Supabase Cancel Warning]: {e}")
            return True
        return False

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self._payments.values())


payment_service = PaymentService()
