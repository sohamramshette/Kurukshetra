from typing import Dict, Any
from app.services.ml_anomaly_service import ml_anomaly_service


def check_transaction_history(
    user_id: str,
    amount: float,
    recipient_id: str = ""
) -> Dict[str, Any]:
    """
    Tool 1: Evaluates payment amount deviation and statistical behavioral anomalies.
    Hybrid architecture: Classical statistical thresholds + Pure-Python Isolation Forest Anomaly Detection.
    See brain.md Section 8 & 10.
    """
    user_baselines = {
        "aarav": {"median": 1200.0, "max_normal": 5000.0}
    }
    baseline = user_baselines.get(user_id.lower(), {"median": 1500.0, "max_normal": 6000.0})

    median = baseline["median"]
    multiplier = round(amount / median, 1)

    # 1. Run Machine Learning Isolation Forest model
    ml_result = ml_anomaly_service.score_transaction(
        amount=amount,
        median_baseline=median,
        is_new_recipient=bool(recipient_id and "mom" not in recipient_id and "landlord" not in recipient_id),
        velocity_1h=1
    )

    is_ml_outlier = ml_result["is_outlier"]
    anomaly_pct = ml_result["anomaly_percentage"]

    if is_ml_outlier or amount > baseline["max_normal"] * 2:
        return {
            "check_name": "Transaction History & ML Anomaly",
            "status": "ANOMALOUS",
            "summary": f"Isolation Forest flagged a behavioral outlier ({anomaly_pct}% model anomaly index). {ml_result['primary_driver']}.",
            "details": {
                "median_amount": median,
                "amount": amount,
                "multiplier": multiplier,
                "ml_model": ml_result["model_name"],
                "ml_anomaly_score": ml_result["anomaly_score"],
                "ml_anomaly_percentage": anomaly_pct,
                "primary_driver": ml_result["primary_driver"],
                "score_delta": ml_result["score_delta"]
            }
        }
    elif amount > baseline["max_normal"]:
        return {
            "check_name": "Transaction History & ML Anomaly",
            "status": "ANOMALOUS",
            "summary": f"Amount (₹{amount:,.2f}) moderately exceeds typical median ({multiplier}x). ML anomaly score: {anomaly_pct}%.",
            "details": {
                "median_amount": median,
                "amount": amount,
                "multiplier": multiplier,
                "ml_model": ml_result["model_name"],
                "ml_anomaly_score": ml_result["anomaly_score"],
                "score_delta": 10
            }
        }

    return {
        "check_name": "Transaction History & ML Anomaly",
        "status": "PASSED",
        "summary": f"Verified normal: Amount ₹{amount:,.2f} is within baseline limits (Isolation Forest anomaly score: {anomaly_pct}%).",
        "details": {
            "median_amount": median,
            "amount": amount,
            "multiplier": multiplier,
            "ml_model": ml_result["model_name"],
            "ml_anomaly_score": ml_result["anomaly_score"],
            "score_delta": -5
        }
    }
