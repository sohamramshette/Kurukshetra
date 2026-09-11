import uuid
from datetime import datetime
from sqlalchemy import Column, Text, Numeric, Integer, Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.db.base import Base


class GuardianDecision(Base):
    """
    Final authoritative protective decision matching Supabase guardian_decisions table.
    See brain.md Section 13, 23 & S2.5.
    """
    __tablename__ = "guardian_decisions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    risk_score = Column(Numeric(5, 2), nullable=False)
    risk_level = Column(Text, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    action = Column(Text, nullable=False)  # ALLOW, WARN, STEP_UP, HOLD, BLOCK
    reason = Column(Text, nullable=True)
    intervention_ui_mode = Column(Text, nullable=True)  # FRICTIONLESS, SOFT_WARNING, STEP_UP_VERIFY, PROTECTIVE_HOLD
    counterfactual = Column(Text, nullable=True)
    cooling_period_seconds = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="guardian_decisions")

    def __repr__(self):
        return f"<GuardianDecision txn={self.transaction_id} action={self.action} score={self.risk_score}>"


class AuditLog(Base):
    """
    Immutable compliance audit trail matching Supabase audit_logs table.
    See brain.md Section 41 & S2.5.
    """
    __tablename__ = "audit_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Text, nullable=True)
    action = Column(Text, nullable=False)
    risk_score = Column(Numeric(5, 2), nullable=False)
    signals_detected = Column(Integer, default=0, nullable=False)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<AuditLog id={self.id} action={self.action} score={self.risk_score}>"


class CoercionConversation(Base):
    """
    Multi-turn coercion detection interview turn matching Supabase coercion_conversations table.
    See brain.md S2.5 & S2.6.
    """
    __tablename__ = "coercion_conversations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    turn_number = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    question_type = Column(Text, default="COERCION_CHECK", nullable=True)
    user_answer = Column(Text, nullable=True)
    coercion_detected = Column(Boolean, nullable=True)
    confidence = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="coercion_conversations")

    def __repr__(self):
        return f"<CoercionConversation txn={self.transaction_id} turn={self.turn_number}>"
