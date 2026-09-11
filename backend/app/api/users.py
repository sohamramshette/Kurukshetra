from fastapi import APIRouter

router = APIRouter()

# Seeded Demo Personas (brain.md Section 6 & 48)
DEMO_PERSONAS = {
    "aarav": {
        "id": "aarav",
        "name": "Aarav Mehta",
        "spending_profile": {
            "median_payment_inr": 1200,
            "max_typical_payment_inr": 5000,
            "monthly_frequency": 42,
            "frequent_recipients": [
                "mom@upi",
                "landlord@bank",
                "grocery@store",
                "friend@upi"
            ]
        },
        "account_standing": "ACTIVE_VERIFIED",
        "risk_tier": "STANDARD"
    }
}


@router.get("/{user_id}")
def get_user_profile(user_id: str):
    """
    Returns user spending profile and baseline history for the demo persona.
    """
    profile = DEMO_PERSONAS.get(user_id.lower())
    if not profile:
        return {
            "id": user_id,
            "name": user_id.capitalize(),
            "spending_profile": {
                "median_payment_inr": 1500,
                "max_typical_payment_inr": 6000,
                "monthly_frequency": 30,
                "frequent_recipients": []
            },
            "account_standing": "STANDARD",
            "risk_tier": "STANDARD"
        }
    return profile
