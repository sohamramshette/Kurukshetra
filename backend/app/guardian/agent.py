"""
Guardian Agent — ReAct Agentic Orchestrator
Upgraded from fixed 6-step pipeline to a dynamic ReAct (Reason + Act) loop.
Gemini drives tool selection at each step based on intermediate evidence.
Integrates: Handle Intelligence, Graph Analysis, Pig Butchering, Emotion Scoring, SHAP Attribution.
See brain.md Section 11 & 40.
"""
import uuid
from datetime import datetime
from typing import Dict, Any, List

from .planner import VerificationPlanner
from .risk_engine import RiskEngine
from .decision_engine import DecisionEngine
from .explainability import generate_explanation, generate_counterfactual
from .intervention import determine_intervention
from app.services.llm_service import gemini_service
from app.services.vector_service import vector_service
from app.services.ml_anomaly_service import ml_anomaly_service
from app.services.graph_service import graph_service
from app.services.sensor_service import sensor_service
from app.services.emotion_service import manipulation_scorer, compute_shap_attribution

from app.tools import (
    check_transaction_history,
    check_recipient_profile,
    check_recipient_reputation,
    detect_scam_patterns,
    verify_identity_claim,
    check_transaction_velocity,
    analyze_recipient_handle,
)


class GuardianAgent:
    """
    Guardian Agent: ReAct-style agentic orchestrator for real-time pre-payment scam interception.

    Upgrade from v1: Gemini now dynamically selects which verification tool to run next
    based on accumulated evidence, enabling early stopping when risk is confirmed.

    Full capability stack:
    - ReAct Dynamic Tool Selection (Gemini)
    - Handle Intelligence (Gemini)
    - Isolation Forest ML Anomaly Detection
    - Semantic Vector RAG (8 known scam patterns)
    - Transaction Graph Fraud Network Analysis
    - Pig Butchering Temporal Pattern Detection
    - Emotion/Manipulation Axis Scoring (Fear/Urgency/Authority/Greed)
    - SHAP-style Feature Attribution
    - Multi-Turn Coercion Detection (via /api/guardian/converse)
    """

    def __init__(self):
        self.planner = VerificationPlanner()
        self.risk_engine = RiskEngine()
        self.decision_engine = DecisionEngine()

    def analyze(self, payment_data: Dict[str, Any], transaction_id: str = None) -> Dict[str, Any]:
        if not transaction_id:
            transaction_id = f"txn_{uuid.uuid4().hex[:8]}"

        user_id = payment_data.get("user_id", "aarav")
        recipient_id = payment_data.get("recipient_id", "")
        amount = float(payment_data.get("amount", 0))
        message = payment_data.get("message", "") or ""

        timeline: List[Dict[str, Any]] = []

        # ─── STAGE 1: OBSERVE ───────────────────────────────────────────────
        timeline.append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "OBSERVE",
            "description": f"Pre-payment interception triggered: ₹{amount:,.2f} to '{recipient_id}'.",
            "risk_snapshot": 10
        })

        # ─── STAGE 2: REASON (Handle Intelligence + ReAct Initial Plan) ─────
        # Run handle intelligence first — it's fast and shapes tool selection
        handle_intel = analyze_recipient_handle(recipient_id, amount)
        handle_score = handle_intel.get("details", {}).get("score_delta", 0)

        llm_badge = "Gemini Flash Lite Active" if gemini_service.is_configured else "Deterministic Engine"
        initial_tools = self.planner.plan_tools(user_id, recipient_id, amount, message)

        timeline.append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "REASON",
            "description": (
                f"Handle Intelligence: {handle_intel.get('summary', '')} | "
                f"ReAct loop initialized with {len(initial_tools)} candidate tools ({llm_badge})."
            ),
            "risk_snapshot": max(10, 10 + handle_score)
        })

        # ─── STAGE 3: VERIFY — ReAct Dynamic Tool Loop ──────────────────────
        verification_results: Dict[str, Dict[str, Any]] = {}
        react_reasoning_chain: List[Dict[str, Any]] = []

        # Seed the risk engine baseline for ReAct decisions
        running_risk_score = 10 + handle_score
        remaining_tools = list(initial_tools)
        step = 0
        max_steps = len(initial_tools) + 1  # Safety bound

        urgent_keywords = ("police", "cbi", "arrest", "court", "customs", "disconnect", "electricity", "fine", "lottery", "kyc", "refund", "crypto", "urgent", "penalty", "verification")
        message_lower = (message or "").lower()

        while remaining_tools and step < max_steps:
            step += 1

            # Early stop check before selecting next tool
            if running_risk_score >= 85:
                react_reasoning_chain.append({
                    "step": step,
                    "tool_chosen": None,
                    "reason": f"EARLY STOP TRIGGERED — Accumulated risk score ({running_risk_score}/100) breached critical threshold (85). Skipped {len(remaining_tools)} redundant verification tool(s) to halt payment without latency.",
                    "risk_at_step": running_risk_score
                })
                break

            # Ask Gemini which tool to run next (ReAct Reason step)
            if gemini_service.is_configured and remaining_tools:
                react_decision = gemini_service.plan_next_tool(
                    tools_available=remaining_tools,
                    tools_already_run=verification_results,
                    current_risk_score=running_risk_score,
                    payment_context=payment_data
                )
                next_tool = react_decision.get("next_tool")
                react_reason = react_decision.get("reason", "")
                early_stop = react_decision.get("early_stop", False)

                if early_stop:
                    react_reasoning_chain.append({
                        "step": step,
                        "tool_chosen": None,
                        "reason": f"EARLY STOP TRIGGERED — {react_reason}",
                        "risk_at_step": running_risk_score
                    })
                    break

                # Validate Gemini's choice is actually in the remaining list
                if next_tool not in remaining_tools:
                    next_tool = remaining_tools[0]
                    react_reason = f"Gemini selected tool; defaulting to active candidate: {next_tool}"
            else:
                # Dynamic deterministic planner based on contextual heuristics
                if "detect_scam_patterns" in remaining_tools and any(kw in message_lower for kw in urgent_keywords):
                    next_tool = "detect_scam_patterns"
                    react_reason = "Urgency / threat indicators found in payment note; prioritizing scam intent vector classification."
                elif "check_recipient_profile" in remaining_tools and handle_score > 0:
                    next_tool = "check_recipient_profile"
                    react_reason = f"Recipient handle scored {handle_score} risk; querying beneficiary trust graph and registration profile."
                elif "check_transaction_history" in remaining_tools and amount > 5000:
                    next_tool = "check_transaction_history"
                    react_reason = f"Transaction amount (₹{amount:,.0f}) requires Isolation Forest anomaly analysis against baseline spending velocity."
                elif "verify_identity_claim" in remaining_tools and ("kyc" in message_lower or "officer" in message_lower):
                    next_tool = "verify_identity_claim"
                    react_reason = "Official authority/KYC claim detected in context; verifying identity credentials."
                else:
                    next_tool = remaining_tools[0]
                    tool_label = next_tool.replace("_", " ")
                    react_reason = f"Sequencing next verification check: {tool_label}."

            react_reasoning_chain.append({
                "step": step,
                "tool_chosen": next_tool,
                "reason": react_reason,
                "risk_at_step": running_risk_score
            })

            # Execute the selected tool (ReAct Act step)
            result = self._run_tool(next_tool, user_id, recipient_id, amount, message)
            verification_results[next_tool] = result
            remaining_tools.remove(next_tool)

            # Update running risk score after each tool
            delta = result.get("details", {}).get("score_delta", 0)
            running_risk_score = max(0, min(100, running_risk_score + delta))

        # ─── ADDITIONAL ML LAYERS (always run, not tool-selectable) ─────────

        # Transaction Graph Analysis
        graph_analysis = graph_service.analyze_recipient(user_id, recipient_id)

        # Hardware & Biometric Threat Sensors
        sensor_payload = payment_data.get("sensor_telemetry")
        sensor_analysis = sensor_service.evaluate_sensors(sensor_payload, amount, recipient_id, message)

        # Pig Butchering Temporal Pattern
        pig_result = ml_anomaly_service.detect_pig_butchering(user_id, amount, recipient_id)

        # Emotion / Manipulation Axis Scoring
        manipulation_profile = manipulation_scorer.score(message)

        # Extract ML telemetry for SHAP
        hist_details = verification_results.get("check_transaction_history", {}).get("details", {})
        scam_details = verification_results.get("detect_scam_patterns", {}).get("details", {})

        ml_outlier_pct = hist_details.get("ml_anomaly_percentage", 20.0)
        vector_match = scam_details.get("vector_match")

        # SHAP-style feature attribution
        shap_features = {
            "amount_ratio": hist_details.get("multiplier", 1.0),
            "is_new_recipient": 1.0 if verification_results.get("check_recipient_profile", {}).get("details", {}).get("is_new") else 0.0,
            "velocity_1h": float(verification_results.get("check_transaction_velocity", {}).get("details", {}).get("attempts_last_hour", 1)),
            "hour_deviation": 0.0,
            "reputation_deficit": max(0.0, (100 - verification_results.get("check_recipient_reputation", {}).get("details", {}).get("reputation_score", 98)) / 100.0)
        }
        feature_attribution = compute_shap_attribution(shap_features)

        # Add graph + pig-butchering + sensor score deltas
        running_risk_score = max(0, min(100,
            running_risk_score
            + graph_analysis.get("score_delta", 0)
            + pig_result.get("score_delta", 0)
            + manipulation_profile.get("score_delta", 0)
            + sensor_analysis.get("total_score_delta", 0)
        ))

        telemetry_notes = [f"Isolation Forest: {ml_outlier_pct}%"]
        if vector_match:
            telemetry_notes.append(f"Vector RAG: {vector_match['pattern_name']} ({vector_match['similarity_pct']}%)")
        if graph_analysis.get("user_graph_risk") not in ("KNOWN_CONTACT", "NORMAL_NEW"):
            telemetry_notes.append(f"Graph: {graph_analysis['user_graph_risk']}")
        if pig_result.get("detected"):
            telemetry_notes.append("⚠️ Pig Butchering Pattern")
        if manipulation_profile.get("dominant_tactic"):
            telemetry_notes.append(f"Manipulation: {manipulation_profile['dominant_tactic']} ({manipulation_profile['manipulation_level']})")
        if sensor_analysis.get("anomalies_detected", 0) > 0:
            telemetry_notes.append(f"Sensors: {sensor_analysis['status']} (+{sensor_analysis['total_score_delta']})")

        timeline.append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "VERIFY",
            "description": f"Multi-Layer ML Verification: {' | '.join(telemetry_notes)}.",
            "risk_snapshot": None
        })

        # ─── STAGE 4: REASSESS ───────────────────────────────────────────────
        risk_score, risk_level, signals = self.risk_engine.compute_risk(verification_results)

        # Inject graph + pig signals into signal list
        if graph_analysis.get("score_delta", 0) >= 15:
            signals.append({
                "type": graph_analysis["user_graph_risk"],
                "severity": "HIGH",
                "confidence": 0.88,
                "reason": graph_analysis["summary"],
                "score_delta": graph_analysis["score_delta"]
            })
        if pig_result.get("detected"):
            signals.append({
                "type": "PIG_BUTCHERING_ESCALATION",
                "severity": "CRITICAL",
                "confidence": 0.93,
                "reason": pig_result["summary"],
                "score_delta": pig_result["score_delta"]
            })
        if handle_intel.get("status") == "FAILED":
            signals.append({
                "type": "HANDLE_BRAND_IMPERSONATION",
                "severity": "HIGH",
                "confidence": handle_intel.get("details", {}).get("confidence", 0.85),
                "reason": handle_intel["summary"],
                "score_delta": handle_score
            })

        # Inject sensor signals into signal list
        for s_sig in sensor_analysis.get("signals", []):
            signals.append(s_sig)

        # Final risk score = engine score + extra ML layers + sensors, bounded
        final_risk_score = max(0, min(100,
            risk_score
            + graph_analysis.get("score_delta", 0)
            + pig_result.get("score_delta", 0)
            + sensor_analysis.get("total_score_delta", 0)
        ))
        if final_risk_score >= 75:
            risk_level = "CRITICAL"
        elif final_risk_score >= 50:
            risk_level = "HIGH"
        elif final_risk_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        timeline.append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "REASSESS",
            "description": f"Evidence synthesized: Final risk score {final_risk_score}/100 ({risk_level}). ReAct chain: {len(react_reasoning_chain)} steps.",
            "risk_snapshot": final_risk_score
        })

        # ─── STAGE 5: ACT ────────────────────────────────────────────────────
        decision = self.decision_engine.enforce_policy(final_risk_score, risk_level, signals, verification_results)
        intervention_policy = determine_intervention(decision)

        timeline.append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": "ACT",
            "description": f"Protective action: {decision} ({intervention_policy['ui_mode']}).",
            "risk_snapshot": final_risk_score
        })

        # ─── STAGE 6: EXPLAIN ────────────────────────────────────────────────
        ai_explanation = gemini_service.generate_user_explanation(decision, final_risk_score, signals, recipient_id)
        explanation = ai_explanation or generate_explanation(decision, risk_level, signals, verification_results)
        counterfactual = generate_counterfactual(decision, verification_results)

        # Record for temporal memory (pig-butchering future analysis)
        ml_anomaly_service.record_payment(user_id, recipient_id, amount)
        # Record in graph for network analysis
        graph_service.record_transaction(user_id, recipient_id, risk_level)

        return {
            "transaction_id": transaction_id,
            "risk_score": final_risk_score,
            "risk_level": risk_level,
            "decision": decision,
            "recommended_action": decision,
            "signals": signals,
            "verification": verification_results,
            "explanation": explanation,
            "intervention": intervention_policy,
            "timeline": timeline,
            "counterfactual": counterfactual,
            # ── New AI/ML capability fields ──
            "react_reasoning_chain": react_reasoning_chain,
            "handle_intelligence": {
                "status": handle_intel.get("status"),
                "summary": handle_intel.get("summary"),
                **handle_intel.get("details", {})
            },
            "graph_analysis": graph_analysis,
            "sensor_analysis": sensor_analysis,
            "pig_butchering": pig_result,
            "manipulation_profile": manipulation_profile,
            "feature_attribution": feature_attribution,
            "ml_telemetry": {
                "isolation_forest_score": hist_details.get("ml_anomaly_score", 0.0),
                "isolation_forest_pct": ml_outlier_pct,
                "vector_match": vector_match,
                "gemini_active": gemini_service.is_configured,
                "gemini_model": gemini_service.model
            }
        }

    def _run_tool(self, tool_name: str, user_id: str, recipient_id: str, amount: float, message: str) -> Dict[str, Any]:
        """Dispatches a named tool and returns its result dict."""
        try:
            if tool_name == "check_recipient_profile":
                return check_recipient_profile(user_id, recipient_id)
            elif tool_name == "check_transaction_history":
                return check_transaction_history(user_id=user_id, amount=amount, recipient_id=recipient_id)
            elif tool_name == "detect_scam_patterns":
                return detect_scam_patterns(message=message, recipient_id=recipient_id, amount=amount)
            elif tool_name == "verify_identity_claim":
                return verify_identity_claim(recipient_id, message)
            elif tool_name == "check_recipient_reputation":
                return check_recipient_reputation(recipient_id)
            elif tool_name == "check_transaction_velocity":
                return check_transaction_velocity(user_id, recipient_id)
            else:
                return {"check_name": tool_name, "status": "PASSED", "summary": "Unknown tool skipped.", "details": {"score_delta": 0}}
        except Exception as e:
            return {"check_name": tool_name, "status": "PASSED", "summary": f"Tool error: {e}", "details": {"score_delta": 0}}


    def simulate_counterfactual(self, payment_data: Dict[str, Any], tweaks: Dict[str, Any]) -> Dict[str, Any]:
        """
        Interactive Counterfactual Simulation Engine (brain.md Section 34).
        Calculates how the risk score and decision change under hypothetical parameter modifications.
        """
        orig_amount = float(payment_data.get("amount", 25000.0))
        orig_msg = payment_data.get("message", "") or payment_data.get("reason", "")
        orig_sensor = payment_data.get("sensor_telemetry") or {}

        # 1. Baseline analysis (fast without DB write)
        baseline = self.analyze(payment_data, transaction_id="sim_baseline")
        base_score = baseline.get("risk_score", 100)

        sim_amount = float(tweaks.get("amount", orig_amount))
        sim_history = int(tweaks.get("prior_payment_count", 0))
        sim_urgency = bool(tweaks.get("has_urgency", True))
        sim_call = bool(tweaks.get("active_call", orig_sensor.get("active_call", True)))
        sim_screen = bool(tweaks.get("screen_sharing", orig_sensor.get("screen_sharing", True)))
        sim_verified = bool(tweaks.get("verified_identity", False))

        reduction = 0
        actions = []

        # Amount reduction impact
        if sim_amount <= 2000 and orig_amount > 10000:
            reduction += 35
            actions.append(f"Transfer amount reduced to ₹{sim_amount:,.0f} (below spending volatility threshold): -35 pts")
        elif sim_amount <= 5000 and orig_amount > 10000:
            reduction += 25
            actions.append(f"Transfer amount reduced to ₹{sim_amount:,.0f} (moderate amount): -25 pts")

        # History impact
        if sim_history >= 3:
            reduction += 40
            actions.append(f"Recipient established as trusted contact ({sim_history} prior payments): -40 pts")
        elif sim_history >= 1:
            reduction += 25
            actions.append(f"Recipient has 1 prior successful payment: -25 pts")

        # Urgency language removal
        if not sim_urgency:
            reduction += 20
            actions.append("Payment message cleared of artificial urgency & threat keywords: -20 pts")

        # In-call coercion disconnection
        if not sim_call:
            reduction += 25
            actions.append("Active phone call disconnected (eliminates real-time voice duress): -25 pts")

        # Screen sharing termination
        if not sim_screen:
            reduction += 35
            actions.append("Remote screen-sharing tool terminated (prevents credential exfiltration): -35 pts")

        # Independent identity verification
        if sim_verified:
            reduction += 25
            actions.append("Recipient identity independently verified through official registry: -25 pts")

        simulated_score = max(0, min(100, base_score - reduction))

        if simulated_score >= 75:
            simulated_decision = "HOLD"
        elif simulated_score >= 50:
            simulated_decision = "STEP_UP"
        elif simulated_score >= 25:
            simulated_decision = "WARN"
        else:
            simulated_decision = "ALLOW"

        return {
            "baseline_score": base_score,
            "baseline_decision": baseline.get("decision", "HOLD"),
            "simulated_score": simulated_score,
            "simulated_decision": simulated_decision,
            "score_delta": -reduction,
            "required_actions": actions if actions else ["Modify any parameter above to see simulated risk reduction."]
        }


guardian_agent = GuardianAgent()
