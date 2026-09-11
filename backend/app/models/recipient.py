import uuid
from datetime import datetime
from sqlalchemy import Column, Text, Numeric, Boolean, DateTime, Uuid
from sqlalchemy.orm import relationship
from app.db.base import Base


class Recipient(Base):
    """
    Payment recipient / counterparty profile matching Supabase recipients table.
    See brain.md Section 23, S2.6 & S2.9.
    """
    __tablename__ = "recipients"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier = Column(Text, unique=True, nullable=False, index=True)  # UPI VPA e.g. "sbi-refund-kyc@okaxis"
    display_name = Column(Text, nullable=False)
    category = Column(Text, default="INDIVIDUAL", nullable=True)  # INDIVIDUAL, MERCHANT, FAMILY, SUSPICIOUS_ENTITY, etc.
    verification_status = Column(Text, nullable=False)  # verified, unverified, suspicious, failed, flagged
    reputation_score = Column(Numeric(10, 2), nullable=False, default=50.0)
    is_flagged = Column(Boolean, default=False, nullable=False)
    flag_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    transactions = relationship("Transaction", back_populates="recipient")

    def __repr__(self):
        return f"<Recipient id={self.id} identifier={self.identifier} status={self.verification_status}>"
