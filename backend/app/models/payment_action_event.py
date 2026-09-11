import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.base import Base


class PaymentActionEvent(Base):
    """Append-only record of every security-sensitive payment action."""

    __tablename__ = "payment_action_events"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid(as_uuid=True), ForeignKey("transactions.id"), nullable=False, index=True)
    actor_key = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    idempotency_key = Column(Text, nullable=False)
    prior_status = Column(Text, nullable=False)
    next_status = Column(Text, nullable=False)
    state_version = Column(Integer, nullable=False)
    acknowledgement = Column(JSON, nullable=True)
    response_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    transaction = relationship("Transaction", back_populates="action_events")
