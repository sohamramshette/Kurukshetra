import random
import math
from typing import List, Dict, Any, Optional, Tuple


class IsolationTreeNode:
    """A node in an Isolation Tree."""
    def __init__(self, left=None, right=None, split_feature: int = 0, split_value: float = 0.0, size: int = 0):
        self.left = left
        self.right = right
        self.split_feature = split_feature
        self.split_value = split_value
        self.size = size
        self.is_leaf = left is None and right is None


class PureIsolationForest:
    """
    Self-contained pure-Python implementation of the Isolation Forest algorithm (Liu et al., 2008).
    Zero external dependencies required.
    """
    def __init__(self, n_trees: int = 60, max_samples: int = 128):
        self.n_trees = n_trees
        self.max_samples = max_samples
        self.trees: List[IsolationTreeNode] = []

    def _c(self, n: int) -> float:
        """Average path length of unsuccessful search in BST."""
        if n <= 1:
            return 1.0
        if n == 2:
            return 1.0
        euler_gamma = 0.5772156649
        return 2.0 * (math.log(n - 1) + euler_gamma) - (2.0 * (n - 1) / n)

    def _build_tree(self, X: List[List[float]], current_height: int, height_limit: int) -> IsolationTreeNode:
        n_samples = len(X)
        if current_height >= height_limit or n_samples <= 1:
            return IsolationTreeNode(size=n_samples)

        n_features = len(X[0])
        # Randomly choose a feature
        feature_idx = random.randint(0, n_features - 1)
        feat_values = [row[feature_idx] for row in X]
        min_val, max_val = min(feat_values), max(feat_values)

        if min_val == max_val:
            return IsolationTreeNode(size=n_samples)

        # Randomly select a split point between min and max
        split_val = random.uniform(min_val, max_val)

        left_X = [row for row in X if row[feature_idx] < split_val]
        right_X = [row for row in X if row[feature_idx] >= split_val]

        left_node = self._build_tree(left_X, current_height + 1, height_limit)
        right_node = self._build_tree(right_X, current_height + 1, height_limit)

        return IsolationTreeNode(
            left=left_node,
            right=right_node,
            split_feature=feature_idx,
            split_value=split_val,
            size=n_samples
        )

    def fit(self, X: List[List[float]]):
        """Fits the forest on baseline normal transaction profiles."""
        self.trees = []
        height_limit = math.ceil(math.log2(max(self.max_samples, 2)))

        for _ in range(self.n_trees):
            # Subsample
            sample_size = min(len(X), self.max_samples)
            sampled_indices = random.sample(range(len(X)), sample_size)
            sample_X = [X[i] for i in sampled_indices]
            tree = self._build_tree(sample_X, 0, height_limit)
            self.trees.append(tree)

    def _path_length(self, x: List[float], node: IsolationTreeNode, current_depth: int) -> float:
        if node.is_leaf:
            return current_depth + (self._c(node.size) if node.size > 1 else 0.0)

        if x[node.split_feature] < node.split_value:
            return self._path_length(x, node.left, current_depth + 1)
        else:
            return self._path_length(x, node.right, current_depth + 1)

    def anomaly_score(self, x: List[float]) -> float:
        """
        Computes anomaly score s in [0.0, 1.0].
        Scores close to 1.0 indicate definite anomalies.
        Scores around 0.5 or less indicate normal instances.
        """
        if not self.trees:
            return 0.5

        avg_path = sum(self._path_length(x, tree, 0) for tree in self.trees) / len(self.trees)
        c_n = self._c(self.max_samples)
        if c_n == 0:
            return 0.5

        score = math.pow(2, -(avg_path / c_n))
        return round(score, 3)


class MLAnomalyService:
    """
    ML Anomaly Detection Service for transaction behavioral features.
    Evaluates 5-dimensional feature vectors:
    [amount_ratio, recipient_novelty, velocity_1h, hour_deviation, reputation_deficit]

    Also implements:
    - Temporal Pattern Memory: tracks per-user payment history
    - Pig Butchering Detection: detects escalating small→large payment scam pattern
    """

    FEATURE_NAMES = [
        "Amount Deviation Ratio",
        "Recipient Novelty",
        "1-Hour Velocity",
        "Off-Peak Hour Deviation",
        "Reputation Deficit"
    ]

    def __init__(self):
        self.forest = PureIsolationForest(n_trees=50, max_samples=64)
        self._train_baseline_model()
        # Temporal memory: user_id → list of {recipient, amount, timestamp}
        self._payment_history: dict = {}

    def record_payment(self, user_id: str, recipient_id: str, amount: float):
        """Records a payment into the user's temporal history for future pattern analysis."""
        import time
        if user_id not in self._payment_history:
            self._payment_history[user_id] = []
        self._payment_history[user_id].append({
            "recipient": recipient_id,
            "amount": amount,
            "timestamp": time.time()
        })
        # Keep only last 20 payments per user to bound memory
        self._payment_history[user_id] = self._payment_history[user_id][-20:]

    def detect_pig_butchering(self, user_id: str, current_amount: float, current_recipient: str) -> dict:
        """
        Pig Butchering Scam Detection (time-series pattern analysis).
        Detects the classic pattern: scammer builds trust with small payments,
        then triggers a large final transfer.

        Pattern signature:
        1. Multiple payments to the same/similar recipient in recent history
        2. Monotonically increasing payment amounts (escalation curve)
        3. Current amount is ≥ 3x median of prior payments to that recipient
        """
        history = self._payment_history.get(user_id, [])
        if len(history) < 2:
            return {
                "detected": False,
                "pattern": "INSUFFICIENT_HISTORY",
                "prior_payments_to_recipient": 0,
                "escalation_ratio": 1.0,
                "summary": "Insufficient process-local payment history to evaluate temporal escalation.",
                "score_delta": 0
            }

        # Find payments to same or similar recipient (case-insensitive prefix match)
        recipient_key = current_recipient.lower().split("@")[0][:6]
        related = [
            p for p in history
            if p["recipient"].lower().startswith(recipient_key)
        ]

        if len(related) < 2:
            # No escalation possible with less than 2 prior same-recipient payments
            return {
                "detected": False,
                "pattern": "NO_PRIOR_RECIPIENT_HISTORY",
                "prior_payments_to_recipient": len(related),
                "escalation_ratio": 1.0,
                "summary": "No repeated process-local recipient history was available for temporal escalation analysis.",
                "score_delta": 0
            }

        prior_amounts = [p["amount"] for p in related]
        median_prior = sorted(prior_amounts)[len(prior_amounts) // 2]
        escalation_ratio = round(current_amount / max(median_prior, 1.0), 2)

        # Check monotonic escalation (each payment is larger than the last)
        is_escalating = all(
            related[i]["amount"] <= related[i + 1]["amount"]
            for i in range(len(related) - 1)
        )

        pig_butchering_detected = (
            escalation_ratio >= 3.0
            and is_escalating
            and len(related) >= 2
        )

        if pig_butchering_detected:
            return {
                "detected": True,
                "pattern": "PIG_BUTCHERING_ESCALATION",
                "prior_payments_to_recipient": len(related),
                "prior_amounts": prior_amounts,
                "escalation_ratio": escalation_ratio,
                "summary": f"Escalating payment pattern detected: {len(related)} prior payments averaging ₹{median_prior:,.0f}, now requesting ₹{current_amount:,.0f} ({escalation_ratio}x). Classic pig-butchering signature.",
                "score_delta": 30
            }
        elif escalation_ratio >= 2.0:
            return {
                "detected": False,
                "pattern": "MODERATE_ESCALATION",
                "prior_payments_to_recipient": len(related),
                "escalation_ratio": escalation_ratio,
                "summary": f"Moderate amount escalation ({escalation_ratio}x prior median) to same recipient.",
                "score_delta": 10
            }
        else:
            return {
                "detected": False,
                "pattern": "NORMAL",
                "prior_payments_to_recipient": len(related),
                "escalation_ratio": escalation_ratio,
                "summary": "No escalating process-local payment pattern was detected for this recipient.",
                "score_delta": 0
            }


    def _train_baseline_model(self):
        """Pre-trains on typical safe transaction distributions for everyday UPI users."""
        random.seed(42)  # Deterministic seed for reproducible testing
        normal_samples = []

        # Generate 150 typical safe baseline transactions
        for _ in range(150):
            amount_ratio = random.uniform(0.1, 1.8)     # Amounts around ₹100 - ₹2,500
            recipient_novelty = random.choice([0.0, 0.0, 0.0, 1.0]) # Mostly known contacts
            velocity_1h = random.choice([1.0, 1.0, 2.0]) # 1 or 2 attempts
            hour_deviation = random.uniform(0.0, 2.0)   # Daytime normal hours
            reputation_deficit = random.uniform(0.0, 0.1) # Trusted recipients

            normal_samples.append([amount_ratio, recipient_novelty, velocity_1h, hour_deviation, reputation_deficit])

        self.forest.fit(normal_samples)

    def score_transaction(
        self,
        amount: float,
        median_baseline: float = 1200.0,
        is_new_recipient: bool = False,
        velocity_1h: int = 1,
        hour: int = 14,
        recipient_reputation: int = 90
    ) -> Dict[str, Any]:
        """
        Evaluates a transaction and returns Isolation Forest outlier score and feature explanation.
        """
        amount_ratio = round(amount / max(median_baseline, 1.0), 2)
        novelty_val = 1.0 if is_new_recipient else 0.0
        vel_val = float(max(1, velocity_1h))

        # Peak hours are 9 AM to 10 PM (deviation is distance from this window)
        hour_deviation = 0.0
        if hour < 8:
            hour_deviation = float(8 - hour)
        elif hour > 23:
            hour_deviation = float(hour - 23)

        rep_deficit = round(max(0.0, (100.0 - recipient_reputation) / 100.0), 2)

        feature_vector = [amount_ratio, novelty_val, vel_val, hour_deviation, rep_deficit]

        # Calculate empirical anomaly score
        score = self.forest.anomaly_score(feature_vector)

        # Scale and calibrate: Anomaly threshold is 0.60
        is_outlier = score >= 0.60

        # Determine primary contributor
        contributors = []
        if amount_ratio > 3.0:
            contributors.append(f"Amount is {amount_ratio}x user median")
        if novelty_val > 0.5:
            contributors.append("Recipient has no historical payment interaction")
        if vel_val > 3:
            contributors.append(f"Unusual surge of {int(vel_val)} transactions in 1 hour")
        if rep_deficit > 0.4:
            contributors.append(f"Recipient carries high dispute deficit ({int(rep_deficit * 100)}%)")
        if hour_deviation > 2.0:
            contributors.append("Unusual off-peak payment time")

        top_reason = ", ".join(contributors) if contributors else "Metrics within normal baseline variance."

        return {
            "model_name": "IsolationForest-Ensemble (Pure-Python)",
            "anomaly_score": score,
            "anomaly_percentage": round(score * 100, 1),
            "is_outlier": is_outlier,
            "primary_driver": top_reason,
            "features": {
                "amount_ratio": amount_ratio,
                "is_new_recipient": is_new_recipient,
                "velocity_1h": velocity_1h,
                "reputation_deficit": rep_deficit
            },
            "score_delta": 25 if score >= 0.70 else (15 if score >= 0.60 else -5)
        }


ml_anomaly_service = MLAnomalyService()
