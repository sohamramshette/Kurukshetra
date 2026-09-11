"""Durable, server-authoritative pre-payment Guardian lifecycle."""
import hashlib
import hmac
import secrets
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models import (
    AuditLog,
    GuardianDecision,
    PaymentActionEvent,
    Recipient,
    RiskEvent,
    Transaction,
    User,
    VerificationCheck,
)

DEMO_ACTOR_KEY = "demo:aarav"
DEMO_USER_NAME = "Aarav Mehta"
GUIDANCE_TEXT_VERSION = "independent-contact-v1"
_ACTION_TOKEN_SECRET = secrets.token_bytes(32)


class PaymentLifecycleError(Exception):
    def __init__(self, status_code: int, code: str, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.detail = detail


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _action_token_for_analysis_key(analysis_idempotency_key: str) -> str:
    """Derive a process-secret capability stable across concurrent retries."""
    return hmac.new(_ACTION_TOKEN_SECRET, analysis_idempotency_key.encode("utf-8"), hashlib.sha256).hexdigest()


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _initial_status(decision: str) -> str:
    return {
        "ALLOW": "AWAITING_CONFIRMATION",
        "WARN": "WARN_ACKNOWLEDGEMENT_REQUIRED",
        "STEP_UP": "STEP_UP_ACKNOWLEDGEMENT_REQUIRED",
        "HOLD": "HELD",
        "BLOCK": "BLOCKED",
    }.get(decision, "HELD")


class PaymentService:
    """Coordinates persisted transitions; the browser never authorizes a state change."""

    def __init__(self):
        self._payments: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()

    def create_pending_payment(self, payment_data: Dict[str, Any], analysis_idempotency_key: Optional[str] = None) -> str:
        transaction_id = f"txn_{uuid.uuid4().hex}"
        analysis_key = analysis_idempotency_key or uuid.uuid4().hex
        action_token = _action_token_for_analysis_key(analysis_key)
        self._payments[transaction_id] = {
            "transaction_id": transaction_id,
            "owner_key": DEMO_ACTOR_KEY,
            "analysis_idempotency_key": analysis_key,
            "recipient_id": payment_data.get("recipient_id", ""),
            "amount": float(payment_data.get("amount", 0)),
            "currency": payment_data.get("currency", "INR"),
            "message": payment_data.get("message", ""),
            "payment_type": payment_data.get("payment_type", "UPI"),
            "status": "ANALYZING",
            "created_at": _iso(_now()),
            "analysis": None,
            "action_token": action_token,
        }
        return transaction_id

    def discard_pending_payment(self, transaction_id: str) -> None:
        self._payments.pop(transaction_id, None)

    def replay_analysis(self, analysis_idempotency_key: Optional[str]) -> Optional[Dict[str, Any]]:
        """Recover a durably committed analysis after an ambiguous client response.

        Possession of the high-entropy analysis key authorizes capability
        rotation for that same canonical demo actor. The raw action token is
        never read from or written to the database.
        """
        if not analysis_idempotency_key:
            return None
        db = SessionLocal()
        try:
            transaction = db.query(Transaction).filter(
                Transaction.owner_key == DEMO_ACTOR_KEY,
                Transaction.analysis_idempotency_key == analysis_idempotency_key,
            ).with_for_update().one_or_none()
            if not transaction or not transaction.analysis_json:
                return None
            action_token = _action_token_for_analysis_key(analysis_idempotency_key)
            # The stable replay capability avoids concurrent retries invalidating
            # one another; only its hash is persisted.
            transaction.action_token_hash = _hash_token(action_token)
            transaction.updated_at = _now()
            analysis = deepcopy(transaction.analysis_json)
            analysis["transaction_id"] = transaction.public_id
            analysis["lifecycle"] = self._lifecycle(transaction)
            analysis["action_token"] = action_token
            db.commit()
            self._payments[transaction.public_id] = {
                "transaction_id": transaction.public_id,
                "owner_key": DEMO_ACTOR_KEY,
                "analysis_idempotency_key": analysis_idempotency_key,
                "status": transaction.status,
                "analysis": analysis,
                "action_token": action_token,
            }
            return analysis
        except Exception as error:
            db.rollback()
            raise PaymentLifecycleError(503, "ANALYSIS_RECOVERY_FAILED", "Guardian could not safely recover the prior analysis. The payment remains paused.") from error
        finally:
            db.close()

    def _resolve_user(self, db) -> User:
        user = db.query(User).filter(User.name == DEMO_USER_NAME).one_or_none()
        if user:
            return user
        user = User(id=uuid.uuid4(), name=DEMO_USER_NAME, risk_profile={"mode": "local-demo"})
        db.add(user)
        db.flush()
        return user

    def _resolve_recipient(self, db, identifier: str) -> Recipient:
        recipient = db.query(Recipient).filter(Recipient.identifier == identifier).one_or_none()
        if recipient:
            return recipient
        # A newly entered recipient is explicitly unverified. This does not
        # manufacture a reputation or external identity confirmation.
        recipient = Recipient(
            id=uuid.uuid4(),
            identifier=identifier,
            display_name=identifier,
            category="INDIVIDUAL",
            verification_status="unverified",
            reputation_score=50,
            is_flagged=False,
        )
        db.add(recipient)
        db.flush()
        return recipient

    def _lifecycle(self, transaction: Transaction) -> Dict[str, Any]:
        acknowledged = transaction.guidance_acknowledged_at is not None
        cooling_complete = not transaction.cooling_ends_at or _now() >= transaction.cooling_ends_at
        confirmation_allowed = transaction.status in {"AWAITING_CONFIRMATION", "WARN_ACKNOWLEDGED"}
        if transaction.status == "STEP_UP_ACKNOWLEDGED":
            confirmation_allowed = cooling_complete

        return {
            "status": transaction.status,
            "state_version": transaction.state_version,
            "confirmation_allowed": confirmation_allowed,
            "requires_independent_guidance_acknowledgement": transaction.requires_guidance_ack and not acknowledged,
            "independent_guidance_acknowledged": acknowledged,
            "guidance_text_version": GUIDANCE_TEXT_VERSION if transaction.requires_guidance_ack else None,
            "cooling_ends_at": _iso(transaction.cooling_ends_at),
        }

    def _response(self, transaction: Transaction, *, confirmed: Optional[bool] = None) -> Dict[str, Any]:
        response = {
            "transaction_id": transaction.public_id,
            "status": transaction.status,
            "state_version": transaction.state_version,
            "lifecycle": self._lifecycle(transaction),
        }
        if confirmed is not None:
            response["confirmed"] = confirmed
        return response

    def persist_analysis(self, transaction_id: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Persist the analysis and its lifecycle before returning it to a client."""
        payment = self._payments.get(transaction_id)
        if not payment:
            raise PaymentLifecycleError(404, "UNKNOWN_TRANSACTION", "Transaction was not found.")

        decision = str(analysis.get("decision", "HOLD"))
        if decision not in {"ALLOW", "WARN", "STEP_UP", "HOLD", "BLOCK"}:
            raise PaymentLifecycleError(503, "INVALID_DECISION", "Guardian returned an invalid protective decision.")

        status = _initial_status(decision)
        requires_guidance = decision in {"WARN", "STEP_UP", "HOLD"}
        cooling_seconds = int(analysis.get("intervention", {}).get("cooling_period_seconds", 0) or 0)
        cooling_ends_at = _now() + timedelta(seconds=cooling_seconds) if cooling_seconds > 0 else None
        token = payment["action_token"]

        db = SessionLocal()
        try:
            user = self._resolve_user(db)
            recipient = self._resolve_recipient(db, payment["recipient_id"])
            stored_analysis = deepcopy(analysis)
            stored_analysis.pop("action_token", None)
            stored_analysis["lifecycle"] = {
                "status": status,
                "state_version": 1,
                "confirmation_allowed": decision == "ALLOW",
                "requires_independent_guidance_acknowledgement": requires_guidance,
                "independent_guidance_acknowledged": False,
                "guidance_text_version": GUIDANCE_TEXT_VERSION if requires_guidance else None,
                "cooling_ends_at": _iso(cooling_ends_at),
            }

            transaction = Transaction(
                id=uuid.uuid4(),
                public_id=transaction_id,
                owner_key=DEMO_ACTOR_KEY,
                analysis_idempotency_key=payment["analysis_idempotency_key"],
                user_id=user.id,
                recipient_id=recipient.id,
                recipient_identifier=payment["recipient_id"],
                amount=payment["amount"],
                currency=payment["currency"],
                payment_type=payment["payment_type"],
                status=status,
                reason=payment["message"],
                risk_score=analysis.get("risk_score", 0),
                risk_level=analysis.get("risk_level", "LOW"),
                decision=decision,
                analysis_json=stored_analysis,
                state_version=1,
                action_token_hash=_hash_token(token),
                requires_guidance_ack=requires_guidance,
                cooling_ends_at=cooling_ends_at,
                updated_at=_now(),
            )
            db.add(transaction)
            db.flush()
            db.add(GuardianDecision(
                id=uuid.uuid4(),
                transaction_id=transaction.id,
                risk_score=analysis.get("risk_score", 0),
                risk_level=analysis.get("risk_level", "LOW"),
                action=decision,
                reason=analysis.get("explanation", ""),
                intervention_ui_mode=analysis.get("intervention", {}).get("ui_mode"),
                counterfactual=analysis.get("counterfactual"),
                cooling_period_seconds=cooling_seconds,
            ))
            for signal in analysis.get("signals", []):
                db.add(RiskEvent(
                    id=uuid.uuid4(), transaction_id=transaction.id,
                    signal_type=signal.get("type", "UNKNOWN"), severity=signal.get("severity", "LOW"),
                    score_delta=signal.get("score_delta", 0), evidence=signal,
                ))
            for check_name, check in analysis.get("verification", {}).items():
                if isinstance(check, dict):
                    db.add(VerificationCheck(
                        id=uuid.uuid4(), transaction_id=transaction.id, check_type=check_name,
                        status=check.get("status", "INCONCLUSIVE"), result=check.get("summary", ""),
                        evidence=check.get("details"),
                    ))
            db.add(AuditLog(
                id=uuid.uuid4(), transaction_id=transaction_id, action="ANALYZED",
                risk_score=analysis.get("risk_score", 0), signals_detected=len(analysis.get("signals", [])),
                reason=analysis.get("explanation", ""), timestamp=_now(),
            ))
            db.commit()

            lifecycle = self._lifecycle(transaction)
            analysis["lifecycle"] = lifecycle
            analysis["action_token"] = token
            payment.update({"status": status, "analysis": analysis, "db_txn_id": str(transaction.id)})
            return analysis
        except IntegrityError as error:
            db.rollback()
            replayed = self.replay_analysis(payment.get("analysis_idempotency_key"))
            if replayed:
                self._payments.pop(transaction_id, None)
                return replayed
            raise PaymentLifecycleError(409, "ANALYSIS_CONFLICT", "A concurrent Guardian analysis could not be recovered safely.") from error
        except Exception as error:
            db.rollback()
            raise PaymentLifecycleError(503, "PERSISTENCE_FAILED", "Guardian could not durably record this security decision. The payment remains paused.") from error
        finally:
            db.close()

    def _locked_transaction(self, db, transaction_id: str) -> Transaction:
        transaction = db.query(Transaction).filter(Transaction.public_id == transaction_id).with_for_update().one_or_none()
        if not transaction:
            raise PaymentLifecycleError(404, "UNKNOWN_TRANSACTION", "Transaction not found.")
        return transaction

    def _authorize_action(self, transaction: Transaction, action_token: Optional[str]) -> None:
        if not action_token or not transaction.action_token_hash:
            raise PaymentLifecycleError(403, "ACTION_TOKEN_REQUIRED", "A valid Guardian action token is required.")
        if not secrets.compare_digest(transaction.action_token_hash, _hash_token(action_token)):
            raise PaymentLifecycleError(403, "ACTION_TOKEN_INVALID", "The Guardian action token is invalid.")

    def _existing_event(self, db, transaction: Transaction, action: str, idempotency_key: str) -> Optional[PaymentActionEvent]:
        return db.query(PaymentActionEvent).filter(
            PaymentActionEvent.transaction_id == transaction.id,
            PaymentActionEvent.action == action,
            PaymentActionEvent.idempotency_key == idempotency_key,
        ).one_or_none()

    def _assert_version(self, transaction: Transaction, expected_version: int) -> None:
        if transaction.state_version != expected_version:
            raise PaymentLifecycleError(409, "STALE_TRANSACTION", "This payment changed. Refresh the Guardian result before taking another action.")

    def _audit_transition(self, db, transaction: Transaction, action: str, prior_status: str, acknowledgement: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        response = self._response(transaction, confirmed=action == "CONFIRM")
        db.add(PaymentActionEvent(
            id=uuid.uuid4(), transaction_id=transaction.id, actor_key=DEMO_ACTOR_KEY,
            action=action, idempotency_key=acknowledgement.pop("_idempotency_key"),
            prior_status=prior_status, next_status=transaction.status,
            state_version=transaction.state_version, acknowledgement=acknowledgement or None,
            response_json=response,
        ))
        db.add(AuditLog(
            id=uuid.uuid4(), transaction_id=transaction.public_id, action=action,
            risk_score=transaction.risk_score or 0, signals_detected=0,
            reason=f"{prior_status} → {transaction.status}", timestamp=_now(),
        ))
        return response

    def _sync_memory(self, transaction: Transaction) -> None:
        payment = self._payments.get(transaction.public_id)
        if transaction.status in {"COMPLETED", "CANCELLED"}:
            self._payments.pop(transaction.public_id, None)
            return
        if payment:
            payment["status"] = transaction.status
            if payment.get("analysis"):
                payment["analysis"]["lifecycle"] = self._lifecycle(transaction)

    def acknowledge_guidance(self, transaction_id: str, action_token: Optional[str], expected_version: int, idempotency_key: str, acknowledgement: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            db = SessionLocal()
            try:
                transaction = self._locked_transaction(db, transaction_id)
                self._authorize_action(transaction, action_token)
                existing = self._existing_event(db, transaction, "ACKNOWLEDGE_GUIDANCE", idempotency_key)
                if existing:
                    return existing.response_json
                self._assert_version(transaction, expected_version)
                if not transaction.requires_guidance_ack:
                    raise PaymentLifecycleError(409, "ACKNOWLEDGEMENT_NOT_REQUIRED", "Guardian did not require independent guidance acknowledgement.")
                if transaction.status not in {"WARN_ACKNOWLEDGEMENT_REQUIRED", "STEP_UP_ACKNOWLEDGEMENT_REQUIRED", "HELD"}:
                    raise PaymentLifecycleError(409, "INVALID_STATE", "Guidance acknowledgement is not available in the current payment state.")

                prior_status = transaction.status
                transaction.guidance_acknowledged_at = _now()
                transaction.guidance_acknowledgement = acknowledgement
                if transaction.status == "WARN_ACKNOWLEDGEMENT_REQUIRED":
                    transaction.status = "WARN_ACKNOWLEDGED"
                elif transaction.status == "STEP_UP_ACKNOWLEDGEMENT_REQUIRED":
                    transaction.status = "STEP_UP_ACKNOWLEDGED"
                # HOLD intentionally remains HELD after guidance is acknowledged.
                transaction.state_version += 1
                transaction.updated_at = _now()
                event_ack = {**acknowledgement, "_idempotency_key": idempotency_key}
                response = self._audit_transition(db, transaction, "ACKNOWLEDGE_GUIDANCE", prior_status, event_ack)
                db.commit()
                self._sync_memory(transaction)
                return response
            except PaymentLifecycleError:
                db.rollback()
                raise
            except IntegrityError as error:
                db.rollback()
                raise PaymentLifecycleError(409, "ACTION_CONFLICT", "This action could not be recorded safely. Retry with a new Guardian result.") from error
            except Exception as error:
                db.rollback()
                raise PaymentLifecycleError(503, "PERSISTENCE_FAILED", "Guardian could not record this acknowledgement. The payment remains paused.") from error
            finally:
                db.close()

    def confirm_payment(self, transaction_id: str, action_token: Optional[str], expected_version: int, idempotency_key: str) -> Dict[str, Any]:
        with self._lock:
            db = SessionLocal()
            try:
                transaction = self._locked_transaction(db, transaction_id)
                self._authorize_action(transaction, action_token)
                existing = self._existing_event(db, transaction, "CONFIRM", idempotency_key)
                if existing:
                    return existing.response_json
                self._assert_version(transaction, expected_version)

                if transaction.decision == "BLOCK" or transaction.status == "BLOCKED":
                    raise PaymentLifecycleError(403, "BLOCKED_BY_POLICY", "Transaction blocked by policy. This payment cannot be confirmed.")
                if transaction.decision == "HOLD" or transaction.status == "HELD":
                    raise PaymentLifecycleError(403, "HELD_BY_POLICY", "Transaction is held by Guardian policy and cannot be confirmed.")
                if transaction.status in {"WARN_ACKNOWLEDGEMENT_REQUIRED", "STEP_UP_ACKNOWLEDGEMENT_REQUIRED"}:
                    raise PaymentLifecycleError(403, "ACKNOWLEDGEMENT_REQUIRED", "Independent guidance acknowledgement is required before confirmation.")
                if transaction.status == "STEP_UP_ACKNOWLEDGED" and transaction.cooling_ends_at and _now() < transaction.cooling_ends_at:
                    raise PaymentLifecycleError(403, "COOLING_PERIOD_ACTIVE", "Guardian's cooling period is still active. The payment remains paused.")
                if transaction.status not in {"AWAITING_CONFIRMATION", "WARN_ACKNOWLEDGED", "STEP_UP_ACKNOWLEDGED"}:
                    raise PaymentLifecycleError(409, "INVALID_STATE", "This payment cannot be confirmed from its current state.")

                prior_status = transaction.status
                transaction.status = "COMPLETED"
                transaction.completed_at = _now()
                transaction.state_version += 1
                transaction.updated_at = _now()
                response = self._audit_transition(db, transaction, "CONFIRM", prior_status, {"_idempotency_key": idempotency_key})
                db.commit()
                self._sync_memory(transaction)
                return response
            except PaymentLifecycleError:
                db.rollback()
                raise
            except IntegrityError as error:
                db.rollback()
                raise PaymentLifecycleError(409, "ACTION_CONFLICT", "This confirmation could not be recorded safely.") from error
            except Exception as error:
                db.rollback()
                raise PaymentLifecycleError(503, "PERSISTENCE_FAILED", "Guardian could not safely confirm this payment. It remains paused.") from error
            finally:
                db.close()

    def cancel_payment(self, transaction_id: str, action_token: Optional[str], expected_version: int, idempotency_key: str) -> Dict[str, Any]:
        with self._lock:
            db = SessionLocal()
            try:
                transaction = self._locked_transaction(db, transaction_id)
                self._authorize_action(transaction, action_token)
                existing = self._existing_event(db, transaction, "CANCEL", idempotency_key)
                if existing:
                    return existing.response_json
                self._assert_version(transaction, expected_version)
                if transaction.status == "COMPLETED":
                    raise PaymentLifecycleError(409, "INVALID_STATE", "A completed demo transaction cannot be cancelled.")
                if transaction.status == "CANCELLED":
                    raise PaymentLifecycleError(409, "INVALID_STATE", "This payment is already cancelled.")

                prior_status = transaction.status
                transaction.status = "CANCELLED"
                transaction.cancelled_at = _now()
                transaction.state_version += 1
                transaction.updated_at = _now()
                response = self._audit_transition(db, transaction, "CANCEL", prior_status, {"_idempotency_key": idempotency_key})
                db.commit()
                self._sync_memory(transaction)
                return response
            except PaymentLifecycleError:
                db.rollback()
                raise
            except IntegrityError as error:
                db.rollback()
                raise PaymentLifecycleError(409, "ACTION_CONFLICT", "This cancellation could not be recorded safely.") from error
            except Exception as error:
                db.rollback()
                raise PaymentLifecycleError(503, "PERSISTENCE_FAILED", "Guardian could not safely cancel this payment. It remains paused.") from error
    def get_payment(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            mem = self._payments.get(transaction_id)
            if mem:
                return mem
            db = SessionLocal()
            try:
                txn = db.query(Transaction).filter(Transaction.public_id == transaction_id).one_or_none()
                if txn and txn.analysis_json:
                    return {
                        "transaction_id": txn.public_id,
                        "status": txn.status,
                        "analysis": txn.analysis_json,
                    }
                return None
            except Exception:
                return None
            finally:
                db.close()


payment_service = PaymentService()
