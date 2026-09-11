"""
Transaction Graph Service — Fraud Network Analysis
Maintains a lightweight in-memory directed graph of user→recipient payment edges.
Detects hub accounts (mule patterns), isolated nodes, and cascade risk.
See brain.md Section 8 & 40.
"""
from typing import Dict, Set, List, Any
from collections import defaultdict
import threading


class TransactionGraphService:
    """
    Pure-Python directed graph tracking payment relationships.
    Thread-safe with a simple lock for concurrent request safety.

    Detects:
    - Hub recipients: many unique first-time senders → same recipient (mule account pattern)
    - Isolated new nodes: recipient has never appeared in any graph edge
    - Cascade risk: user has already paid another known-suspicious recipient recently
    """

    def __init__(self):
        self._lock = threading.Lock()
        # user_id -> set of recipient_ids they have paid
        self._user_edges: Dict[str, Set[str]] = defaultdict(set)
        # recipient_id -> set of user_ids who have paid them
        self._recipient_edges: Dict[str, Set[str]] = defaultdict(set)
        # recipients flagged as suspicious by Guardian (risk_level >= HIGH)
        self._flagged_recipients: Set[str] = set()

        # Seed with some realistic historical data for demo richness
        self._seed_demo_graph()

    def _seed_demo_graph(self):
        """Seeds graph with realistic baseline transaction history."""
        safe_pairs = [
            ("aarav", "mom@upi"),
            ("aarav", "landlord@bank"),
            ("aarav", "grocery@store"),
            ("aarav", "friend@upi"),
            ("aarav", "zomato@icici"),
            ("user1", "mom@upi"),
            ("user2", "grocery@store"),
            ("user3", "friend@upi"),
            ("user4", "landlord@bank"),
        ]
        for uid, rid in safe_pairs:
            self._user_edges[uid].add(rid)
            self._recipient_edges[rid].add(uid)

    def record_transaction(self, user_id: str, recipient_id: str, risk_level: str = "LOW"):
        """Records a payment edge in the graph. Call after each analysis."""
        with self._lock:
            self._user_edges[user_id].add(recipient_id)
            self._recipient_edges[recipient_id].add(user_id)
            if risk_level in ("HIGH", "CRITICAL"):
                self._flagged_recipients.add(recipient_id)

    def analyze_recipient(self, user_id: str, recipient_id: str) -> Dict[str, Any]:
        """
        Evaluates a (user, recipient) pair for graph-level fraud signals.
        Returns risk classification and score delta.
        """
        with self._lock:
            unique_senders = len(self._recipient_edges.get(recipient_id, set()))
            user_knows_recipient = recipient_id in self._user_edges.get(user_id, set())

            # Has this user paid any flagged recipient recently?
            user_past_recipients = self._user_edges.get(user_id, set())
            cascade_overlap = user_past_recipients & self._flagged_recipients
            cascade_risk = len(cascade_overlap) > 0

            is_hub = unique_senders >= 5 and not user_knows_recipient
            is_isolated_new = unique_senders == 0
            is_flagged = recipient_id in self._flagged_recipients

        # Classify
        if is_flagged:
            return {
                "is_hub_recipient": is_hub,
                "unique_senders_to_recipient": unique_senders,
                "user_previously_paid": user_knows_recipient,
                "cascade_risk_detected": cascade_risk,
                "cascade_overlap_count": len(cascade_overlap),
                "user_graph_risk": "FLAGGED_RECIPIENT",
                "summary": f"Recipient '{recipient_id}' was previously flagged by Guardian as high-risk.",
                "score_delta": 30
            }
        elif is_hub:
            return {
                "is_hub_recipient": True,
                "unique_senders_to_recipient": unique_senders,
                "user_previously_paid": False,
                "cascade_risk_detected": cascade_risk,
                "cascade_overlap_count": len(cascade_overlap),
                "user_graph_risk": "HUB_MULE_PATTERN",
                "summary": f"Recipient receives payments from {unique_senders} unique users — possible hub/mule account.",
                "score_delta": 25
            }
        elif is_isolated_new:
            return {
                "is_hub_recipient": False,
                "unique_senders_to_recipient": 0,
                "user_previously_paid": False,
                "cascade_risk_detected": cascade_risk,
                "cascade_overlap_count": len(cascade_overlap),
                "user_graph_risk": "ISOLATED_NEW_NODE",
                "summary": f"Recipient '{recipient_id}' has never appeared in any payment network — completely new node.",
                "score_delta": 15
            }
        elif cascade_risk:
            return {
                "is_hub_recipient": False,
                "unique_senders_to_recipient": unique_senders,
                "user_previously_paid": user_knows_recipient,
                "cascade_risk_detected": True,
                "cascade_overlap_count": len(cascade_overlap),
                "user_graph_risk": "CASCADE_RISK",
                "summary": f"User has prior payments to flagged recipients — possible multi-stage scam cascade.",
                "score_delta": 20
            }
        elif user_knows_recipient:
            return {
                "is_hub_recipient": False,
                "unique_senders_to_recipient": unique_senders,
                "user_previously_paid": True,
                "cascade_risk_detected": False,
                "cascade_overlap_count": 0,
                "user_graph_risk": "KNOWN_CONTACT",
                "summary": f"Recipient is an existing known contact with prior transaction history.",
                "score_delta": -10
            }
        else:
            return {
                "is_hub_recipient": False,
                "unique_senders_to_recipient": unique_senders,
                "user_previously_paid": False,
                "cascade_risk_detected": False,
                "cascade_overlap_count": 0,
                "user_graph_risk": "NORMAL_NEW",
                "summary": f"Recipient is new but shows no network-level fraud indicators.",
                "score_delta": 5
            }


graph_service = TransactionGraphService()
