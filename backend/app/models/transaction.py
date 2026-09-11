import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.base import Base


class Transaction(Base):
    """Durable pre-payment transaction and Guardian lifecycle record."""

    __tablename__ = "transactions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Uuid(as_uuid=True), ForeignKey("recipients.id"), nullable=False)
    recipient_identifier = Column(Text, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String, default="INR", nullable=False)
    payment_type = Column(Text, default="UPI", nullable=False)
    status = Column(Text, nullable=False, default="ANALYZING")
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    risk_score = Column(Numeric(5, 2), nullable=True)
    risk_level = Column(Text, nullable=True)
    decision = Column(Text, nullable=True)
    analysis_json = Column(JSON, nullable=True)

    # Phase 2 lifecycle and replay-protection fields (additive migration).
    public_id = Column(Text, nullable=True, unique=True, index=True)
    owner_key = Column(Text, nullable=False, default="demo:aarav", index=True)
    analysis_idempotency_key = Column(Text, nullable=True)
    state_version = Column(Integer, nullable=False, default=1)
    action_token_hash = Column(Text, nullable=True)
    requires_guidance_ack = Column(Boolean, nullable=False, default=False)
    guidance_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    guidance_acknowledgement = Column(JSON, nullable=True)
    cooling_ends_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="transactions")
    recipient = relationship("Recipient", back_populates="transactions")
    risk_events = relationship("RiskEvent", back_populates="transaction", cascade="all, delete-orphan")
    verification_checks = relationship("VerificationCheck", back_populates="transaction", cascade="all, delete-orphan")
    guardian_decisions = relationship("GuardianDecision", back_populates="transaction", cascade="all, delete-orphan")
    coercion_conversations = relationship("CoercionConversation", back_populates="transaction", cascade="all, delete-orphan")
    action_events = relationship("PaymentActionEvent", back_populates="transaction", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Transaction public_id={self.public_id} status={self.status} decision={self.decision}>"
