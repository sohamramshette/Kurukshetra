from typing import List, Dict, Any


class VerificationPlanner:
    """
    Agentic tool planner: dynamically decides what needs to be verified before payment.
    See brain.md Section 10 & 30.
    """

    @staticmethod
    def plan_tools(user_id: str, recipient_id: str, amount: float, message: str = "") -> List[str]:
        # Baseline essential checks for all payments
        tools = ["check_recipient_profile", "check_transaction_history"]

        # If a message or payment note exists, analyze scam language & identity claims
        if message and len(message.strip()) > 0:
            tools.append("detect_scam_patterns")
            tools.append("verify_identity_claim")

        # If amount is substantial (> 2000 INR), query reputation intelligence & velocity
        if amount > 2000:
            tools.append("check_recipient_reputation")
            tools.append("check_transaction_velocity")

        return tools
