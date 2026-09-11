import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, JSON, Uuid
from sqlalchemy.orm import relationship
from app.db.base import Base


class Transaction(Base):
    """
    Payment transaction record matching Supabase transactions table.
    See brain.md Section 23 & S2.5.
    """
    __tablename__ = "transactions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Uuid(as_uuid=True), ForeignKey("recipients.id"), nullable=False)
    recipient_identifier = Column(Text, nullable=True)  # Direct UPI handle (e.g. "sbi-refund-kyc@okaxis")
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String, default="INR", nullable=False)
    payment_type = Column(Text, default="UPI", nullable=False)
    status = Column(Text, nullable=False, default="ANALYZING")
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    risk_score = Column(Numeric(5, 2), nullable=True)
    risk_level = Column(Text, nullable=True)
    decision = Column(Text, nullable=True)
    analysis_json = Column(JSON, nullable=True)  # Full AI telemetry (ReAct chain, SHAP, Graph, Emotion axes)

    # Relationships
    user = relationship("User", back_populates="transactions")
    recipient = relationship("Recipient", back_populates="transactions")
    risk_events = relationship("RiskEvent", back_populates="transaction", cascade="all, delete-orphan")
    verification_checks = relationship("VerificationCheck", back_populates="transaction", cascade="all, delete-orphan")
    guardian_decisions = relationship("GuardianDecision", back_populates="transaction", cascade="all, delete-orphan")
    coercion_conversations = relationship("CoercionConversation", back_populates="transaction", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Transaction id={self.id} amount={self.amount} status={self.status} risk={self.risk_score}>"
