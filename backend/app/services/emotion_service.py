"""
Emotion & Manipulation Axis Scoring Service
Scores payment message text on 4 psychological manipulation axes:
  Fear, Urgency, Authority, Greed
Returns a 0.0-1.0 score per axis plus SHAP-style feature attribution for Isolation Forest.
"""
from typing import Dict, Any, List


# --- Manipulation axis keyword lexicons ---

FEAR_SIGNALS = [
    "disconnected", "arrested", "seized", "blocked", "suspended", "cancelled",
    "expired", "penalty", "fine", "legal action", "court", "fir", "police",
    "nabard", "enforcement", "emi", "debt", "loan overdue", "account frozen"
]

URGENCY_SIGNALS = [
    "immediately", "urgent", "tonight", "today", "within 10 minutes",
    "within 5 minutes", "now", "hurry", "last chance", "act fast",
    "expires today", "deadline", "don't delay", "asap"
]

AUTHORITY_SIGNALS = [
    "official", "bank officer", "customer support", "support team", "kyc officer",
    "police", "government", "electricity department", "rbi", "sebi", "tax authority",
    "income tax", "customs", "army", "court notice", "aadhaar"
]

GREED_SIGNALS = [
    "lottery", "prize", "won", "cashback", "reward", "refund", "lucky draw",
    "kbc", "double money", "invest", "commission", "profit", "task earn",
    "part-time job", "work from home", "guaranteed return"
]


class ManipulationScorer:
    """
    Hybrid manipulation axis scorer.
    Combines keyword lexicon with weighted confidence scoring.
    """

    @staticmethod
    def _score_axis(text: str, signals: List[str]) -> float:
        """Score a single manipulation axis from 0.0 to 1.0."""
        hits = sum(1 for s in signals if s in text)
        if hits == 0:
            return 0.0
        # Sigmoid-like saturation: 1 hit = 0.45, 2 = 0.70, 3+ = 0.90+
        return min(0.98, 0.45 + (hits - 1) * 0.25)

    def score(self, message: str) -> Dict[str, Any]:
        """
        Scores a payment message on all 4 manipulation axes.
        Returns per-axis scores, overall manipulation score, and dominant tactic.
        """
        if not message or len(message.strip()) < 5:
            return {
                "fear": 0.0,
                "urgency": 0.0,
                "authority": 0.0,
                "greed": 0.0,
                "overall_manipulation_score": 0.0,
                "dominant_tactic": None,
                "manipulation_level": "NONE",
                "score_delta": 0
            }

        lower = message.lower()
        fear = self._score_axis(lower, FEAR_SIGNALS)
        urgency = self._score_axis(lower, URGENCY_SIGNALS)
        authority = self._score_axis(lower, AUTHORITY_SIGNALS)
        greed = self._score_axis(lower, GREED_SIGNALS)

        # Weighted overall: fear & urgency are highest-weight (most dangerous combo)
        overall = round(
            fear * 0.30
            + urgency * 0.30
            + authority * 0.25
            + greed * 0.15,
            3
        )

        # Identify the dominant manipulation tactic
        axes = {"FEAR": fear, "URGENCY": urgency, "AUTHORITY": authority, "GREED": greed}
        dominant = max(axes, key=axes.get) if any(v > 0 for v in axes.values()) else None

        if overall >= 0.65:
            level = "CRITICAL"
            score_delta = 20
        elif overall >= 0.40:
            level = "HIGH"
            score_delta = 12
        elif overall >= 0.20:
            level = "MEDIUM"
            score_delta = 5
        else:
            level = "NONE"
            score_delta = 0

        return {
            "fear": round(fear, 3),
            "urgency": round(urgency, 3),
            "authority": round(authority, 3),
            "greed": round(greed, 3),
            "overall_manipulation_score": overall,
            "dominant_tactic": dominant,
            "manipulation_level": level,
            "score_delta": score_delta
        }


def compute_shap_attribution(features: Dict[str, float]) -> Dict[str, Any]:
    """
    SHAP-style (Shapley-inspired) feature attribution for Isolation Forest output.
    Computes proportional contribution of each feature to the total anomaly signal.

    Features expected:
      amount_ratio, recipient_novelty, velocity_1h, hour_deviation, reputation_deficit
    """
    feature_weights = {
        "amount_ratio": 0.40,        # Strongest predictor in training data
        "recipient_novelty": 0.25,   # New recipient is a strong scam signal
        "reputation_deficit": 0.20,  # Reputation score matters
        "velocity_1h": 0.10,         # Burst attempts
        "hour_deviation": 0.05       # Off-peak timing
    }

    # Normalize feature values to 0-1 range for contribution calculation
    normalized = {
        "amount_ratio": min(1.0, features.get("amount_ratio", 0) / 5.0),
        "recipient_novelty": float(features.get("is_new_recipient", 0)),
        "velocity_1h": min(1.0, features.get("velocity_1h", 1) / 5.0),
        "hour_deviation": min(1.0, features.get("hour_deviation", 0) / 8.0),
        "reputation_deficit": features.get("reputation_deficit", 0)
    }

    weighted = {k: round(normalized[k] * feature_weights.get(k, 0), 3) for k in normalized}
    total = sum(weighted.values())

    if total > 0:
        proportional = {k: round(v / total, 3) for k, v in weighted.items()}
    else:
        proportional = {k: 0.0 for k in weighted}

    top_driver = max(proportional, key=proportional.get)

    return {
        "top_driver": top_driver,
        "contributions": proportional,
        "method": "Shapley-Inspired Proportional Attribution"
    }


manipulation_scorer = ManipulationScorer()
