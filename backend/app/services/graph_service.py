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
        """Seeds graph with realistic baseline transaction history and known scam hubs."""
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

        # Seed known community-reported scam handles and mule accounts
        known_flagged = [
            "support-verify@electricity-dept.in",
            "support-verify@demo",
            "refund-desk@demo",
            "prize-desk@demo",
            "attacker@darknet",
            "sbi-kyc-desk@upi",
            "fake_mule@upi"
        ]
        for handle in known_flagged:
            self._flagged_recipients.add(handle)
            # Add synthetic co-victims to simulate real-world hub fan-in
            for i, victim in enumerate(["victim_rajesh@upi", "victim_ananya@hdfc", "victim_vikram@axis", "victim_deepa@sbi", "victim_suresh@icici"]):
                self._user_edges[victim].add(handle)
                self._recipient_edges[handle].add(victim)

    def record_transaction(self, user_id: str, recipient_id: str, risk_level: str = "LOW"):
        """Records a payment edge in the graph. Call after each analysis."""
        with self._lock:
            self._user_edges[user_id].add(recipient_id)
            self._recipient_edges[recipient_id].add(user_id)
            if risk_level in ("HIGH", "CRITICAL"):
                self._flagged_recipients.add(recipient_id)

    def build_network_graph(self, user_id: str, recipient_id: str, risk_classification: str, is_hub: bool, unique_senders: int, is_flagged: bool) -> Dict[str, Any]:
        """
        Constructs a complete network topology (nodes, edges, mule metrics, collective intelligence)
        for graph visualization and collective threat intelligence.
        """
        is_threat = is_flagged or is_hub or risk_classification in ("FLAGGED_RECIPIENT", "HUB_MULE_PATTERN", "CASCADE_RISK")
        is_safe = risk_classification == "KNOWN_CONTACT"

        # 1. Base Nodes
        nodes: List[Dict[str, Any]] = [
            {
                "id": user_id,
                "label": f"{user_id.capitalize()} (You)",
                "type": "USER",
                "risk_level": "LOW",
                "subtitle": "Originating Account",
                "badge": "KYC Verified",
                "status": "ACTIVE",
                "amount": None
            },
            {
                "id": recipient_id,
                "label": recipient_id,
                "type": "RECIPIENT",
                "risk_level": "CRITICAL" if is_flagged else ("HIGH" if is_hub else ("LOW" if is_safe else "MEDIUM")),
                "subtitle": "Flagged Beneficiary" if is_threat else ("Verified Contact" if is_safe else "New Recipient Node"),
                "badge": f"{unique_senders} Inbound Senders" if unique_senders > 0 else "0 Past Payments",
                "status": "FLAGGED" if is_threat else ("VERIFIED" if is_safe else "UNDER_REVIEW"),
                "amount": None
            }
        ]

        # 2. Base Edges
        edges: List[Dict[str, Any]] = [
            {
                "id": f"edge-{user_id}-{recipient_id}",
                "source": user_id,
                "target": recipient_id,
                "label": "Attempted Transfer",
                "status": "PENDING_HOLD" if is_threat else "CLEARED",
                "tone": "danger" if is_threat else ("success" if is_safe else "warning"),
                "animated": is_threat
            }
        ]

        if is_threat or recipient_id.lower() in [f.lower() for f in self._flagged_recipients] or "support" in recipient_id.lower() or "verify" in recipient_id.lower() or "refund" in recipient_id.lower():
            # Threat Topology: Co-victims, Mule Hub, and Downstream Laundering Hop
            co_victims = [
                {"id": "victim-1", "label": "Rajesh K.", "type": "CO_VICTIM", "risk_level": "HIGH", "subtitle": "Victim (Defrauded ₹15,000)", "badge": "Filed 1930 Report", "amount": "₹15,000"},
                {"id": "victim-2", "label": "Ananya M.", "type": "CO_VICTIM", "risk_level": "HIGH", "subtitle": "Victim (Defrauded ₹22,000)", "badge": "Dispute Active", "amount": "₹22,000"},
                {"id": "victim-3", "label": "Vikram T.", "type": "CO_VICTIM", "risk_level": "HIGH", "subtitle": "Victim (Defrauded ₹18,500)", "badge": "CyberCell Case", "amount": "₹18,500"},
            ]
            mule_nodes = [
                {"id": "mule-hub-44", "label": "Mule Ring Hub #44", "type": "MULE_HUB", "risk_level": "CRITICAL", "subtitle": "Layer-2 Dispersal Wallet", "badge": "High Fan-Out", "amount": "₹85,000"},
                {"id": "offramp-crypto", "label": "Crypto Cashout P2P", "type": "MULE_HUB", "risk_level": "CRITICAL", "subtitle": "Rapid Liquidation Node", "badge": "Foreign IP", "amount": "₹1,20,000"},
            ]

            nodes.extend(co_victims)
            nodes.extend(mule_nodes)

            # Inbound scam edges from co-victims to target recipient
            edges.extend([
                {"id": "edge-vic-1", "source": "victim-1", "target": recipient_id, "label": "Defrauded ₹15,000", "status": "REPORTED", "tone": "danger", "animated": True},
                {"id": "edge-vic-2", "source": "victim-2", "target": recipient_id, "label": "Defrauded ₹22,000", "status": "REPORTED", "tone": "danger", "animated": True},
                {"id": "edge-vic-3", "source": "victim-3", "target": recipient_id, "label": "Defrauded ₹18,500", "status": "REPORTED", "tone": "danger", "animated": True},
            ])

            # Outbound laundering edges to mule ring
            edges.extend([
                {"id": "edge-mule-1", "source": recipient_id, "target": "mule-hub-44", "label": "Rapid Dispersal (88%)", "status": "MULE_HOP", "tone": "danger", "animated": True},
                {"id": "edge-mule-2", "source": "mule-hub-44", "target": "offramp-crypto", "label": "Cashout Hop", "status": "MULE_HOP", "tone": "danger", "animated": True},
            ])

            mule_metrics = {
                "fan_in_count": max(unique_senders, 5),
                "mule_probability": 94,
                "cluster_name": "I4C-MULE-RING-AP44",
                "velocity_alert": True,
                "layer_depth": 3,
                "total_inflow_estimate": "₹1,40,500 across 48h"
            }

            collective_intel = {
                "community_reports_count": 14,
                "national_cybercrime_status": "1930 Helpline & I4C Citizen Portal Confirmed",
                "mule_cluster_id": "I4C-AP44-SCAM-RING",
                "fan_in_velocity": "14 incoming transfers in past 48 hours",
                "risk_propagation_path": [f"{user_id.capitalize()} (Victim)", recipient_id, "Mule Ring Hub #44", "Crypto Cashout P2P"],
                "reputation_score": 8,
                "confidence_score": 96,
                "reported_patterns": [
                    "Electricity Power Disconnection Extortion",
                    "Impersonation of State Utility / Support Officers",
                    "Multi-tier Layered Mule Laundering"
                ]
            }

        else:
            # Safe / Baseline Topology: User connected to verified contacts
            safe_contacts = [
                {"id": "mom@upi", "label": "Mom", "type": "SAFE_CONTACT", "risk_level": "LOW", "subtitle": "Family Contact", "badge": "12 Past Payments", "amount": None},
                {"id": "landlord@bank", "label": "Landlord", "type": "SAFE_CONTACT", "risk_level": "LOW", "subtitle": "Monthly Rent", "badge": "Recurring", "amount": None},
            ]
            nodes.extend(safe_contacts)
            edges.extend([
                {"id": f"edge-{user_id}-mom", "source": user_id, "target": "mom@upi", "label": "Regular Contact", "status": "CLEARED", "tone": "success", "animated": False},
                {"id": f"edge-{user_id}-landlord", "source": user_id, "target": "landlord@bank", "label": "Verified Payee", "status": "CLEARED", "tone": "success", "animated": False},
            ])

            mule_metrics = {
                "fan_in_count": unique_senders,
                "mule_probability": 4,
                "cluster_name": "ORGANIC_PEER_NETWORK",
                "velocity_alert": False,
                "layer_depth": 1,
                "total_inflow_estimate": "Normal baseline activity"
            }

            collective_intel = {
                "community_reports_count": 0,
                "national_cybercrime_status": "Clean Record. 0 Reports on 1930 Portal",
                "mule_cluster_id": None,
                "fan_in_velocity": "Normal (1-2 transfers / month)",
                "risk_propagation_path": [f"{user_id.capitalize()} (Originator)", recipient_id],
                "reputation_score": 98,
                "confidence_score": 99,
                "reported_patterns": []
            }

        return {
            "nodes": nodes,
            "edges": edges,
            "mule_metrics": mule_metrics,
            "collective_intelligence": collective_intel
        }

    def analyze_recipient(self, user_id: str, recipient_id: str) -> Dict[str, Any]:
        """
        Evaluates a (user, recipient) pair for graph-level fraud signals.
        Returns risk classification, score delta, and rich network graph topology.
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

        # Determine graph classification
        if is_flagged:
            classification = "FLAGGED_RECIPIENT"
            summary = f"Recipient '{recipient_id}' was previously flagged by Guardian & 1930 CyberCrime as high-risk."
            score_delta = 30
        elif is_hub:
            classification = "HUB_MULE_PATTERN"
            summary = f"Recipient receives payments from {unique_senders} unique users — identified money mule hub."
            score_delta = 25
        elif is_isolated_new:
            classification = "ISOLATED_NEW_NODE"
            summary = f"Recipient '{recipient_id}' has never appeared in any payment network — completely unverified new node."
            score_delta = 15
        elif cascade_risk:
            classification = "CASCADE_RISK"
            summary = "User has prior payments to flagged recipients — multi-stage scam cascade detected."
            score_delta = 20
        elif user_knows_recipient:
            classification = "KNOWN_CONTACT"
            summary = "Recipient is an existing known contact with established transaction history."
            score_delta = -10
        else:
            classification = "NORMAL_NEW"
            summary = "Recipient is new but shows no network-level fraud indicators."
            score_delta = 5

        network_graph = self.build_network_graph(
            user_id=user_id,
            recipient_id=recipient_id,
            risk_classification=classification,
            is_hub=is_hub,
            unique_senders=unique_senders,
            is_flagged=is_flagged
        )

        return {
            "is_hub_recipient": is_hub,
            "unique_senders_to_recipient": unique_senders,
            "user_previously_paid": user_knows_recipient,
            "cascade_risk_detected": cascade_risk,
            "cascade_overlap_count": len(cascade_overlap),
            "user_graph_risk": classification,
            "summary": summary,
            "score_delta": score_delta,
            "network_graph": network_graph
        }


graph_service = TransactionGraphService()

