"""
Database initialization and verification script for Payment Guardian.
Directly linked to Supabase project: jqsppbnmxtmstlrbsyyl
Run with: python -m app.db.init_db
"""

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models import User, Recipient, Transaction, GuardianDecision, AuditLog, RiskEvent, VerificationCheck, CoercionConversation


def init_db():
    print("Testing live database connection to Supabase...")
    db = SessionLocal()
    try:
        # Check tables & existing rows
        user_count = db.query(User).count()
        recipient_count = db.query(Recipient).count()
        txn_count = db.query(Transaction).count()

        print(f"Connected to Supabase successfully!")
        print(f" - Users in DB: {user_count}")
        print(f" - Recipients in DB: {recipient_count}")
        print(f" - Transactions in DB: {txn_count}")

        # Show seeded demo user
        demo_user = db.query(User).first()
        if demo_user:
            print(f" - Primary Demo User: {demo_user.name} (UUID: {demo_user.id})")

        # Show recipients
        recipients = db.query(Recipient).all()
        print(f" - Active Demo Counterparties ({len(recipients)}):")
        for r in recipients:
            print(f"    * {r.identifier} -> {r.display_name} [{r.verification_status.upper()}] (Score: {r.reputation_score})")

    except Exception as e:
        print(f"Database error: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
