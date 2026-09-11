import uuid
from datetime import datetime
from sqlalchemy import Column, Text, Numeric, DateTime, ForeignKey, JSON, Uuid
from sqlalchemy.orm import relationship
from app.db.base import Base


class RiskEvent(Base):
    """
    Specific suspicious signal flagged during risk analysis matching Supabase risk_events table.
    See brain.md Section 8, 23 & S2.8.
    """
    __tablename__ = "risk_events"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    signal_type = Column(Text, nullable=False)
    severity = Column(Text, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    score_delta = Column(Numeric(5, 2), nullable=False, default=0.0)
    evidence = Column(JSON, nullable=True)  # JSONB
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="risk_events")

    def __repr__(self):
        return f"<RiskEvent type={self.signal_type} severity={self.severity} delta={self.score_delta}>"


class VerificationCheck(Base):
    """
    Specific tool verification output matching Supabase verification_checks table.
    See brain.md Section 10, 23 & S2.5.
    """
    __tablename__ = "verification_checks"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    check_type = Column(Text, nullable=False)
    status = Column(Text, nullable=False)  # PASSED, FAILED, ANOMALOUS, WARNING
    result = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=True)  # JSONB
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="verification_checks")

    def __repr__(self):
        return f"<VerificationCheck check={self.check_type} status={self.status}>"
