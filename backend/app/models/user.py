import uuid
from datetime import datetime
from sqlalchemy import Column, Text, DateTime, JSON, Uuid
from sqlalchemy.orm import relationship
from app.db.base import Base


class User(Base):
    """
    Payer / Account holder model matching Supabase users table.
    See brain.md Section 23.
    """
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    risk_profile = Column(JSON, nullable=True)  # JSONB: typical_payment_min, typical_payment_max, etc.
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} name={self.name}>"
