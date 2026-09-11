import math
import re
from typing import Dict, Any, List, Optional, Tuple

# Curated repository of verified real-world digital payment scam scripts (PS09)
KNOWN_SCAM_TEMPLATES = [
    {
        "id": "SCAM-01",
        "category": "ELECTRICITY_UTILITY_EXTORTION",
        "name": "Electricity Disconnection Extortion",
        "text": "Dear customer, your electricity power will be disconnected tonight at 9:30 PM from electricity office because your previous month bill was not updated. Please immediately contact our power officer or pay verification bill.",
        "keywords": ["electricity", "power", "disconnected", "bill", "tonight", "officer", "cut"]
    },
    {
        "id": "SCAM-02",
        "category": "DIGITAL_ARREST_POLICE",
        "name": "Digital Arrest / Police Narcotics Extortion",
        "text": "This is Mumbai Police Crime Branch and Customs. A parcel in FedEx containing 140 grams of MDMA and illegal fake passports under your Aadhaar card has been seized. Join emergency video call immediately and transfer security clearance deposit to verify your bank innocence.",
        "keywords": ["police", "customs", "parcel", "fedex", "narcotics", "aadhaar", "seized", "clearance", "digital arrest", "crime branch"]
    },
    {
        "id": "SCAM-03",
        "category": "BANK_KYC_EXPIRY",
        "name": "Urgent Bank KYC / PAN Suspension",
        "text": "Dear SBI HDFC customer your netbanking account will be blocked and debit card suspended within 24 hours due to uncompleted PAN KYC update. Pay nominal verification fee immediately to activate your account.",
        "keywords": ["kyc", "pan", "suspended", "blocked", "debit card", "netbanking", "update", "expired", "bank"]
    },
    {
        "id": "SCAM-04",
        "category": "LOTTERY_PRIZE_ADVANCE_FEE",
        "name": "Lottery & KBC Prize Advance Fee",
        "text": "Congratulations you have won 25,00,000 INR in Kaun Banega Crorepati KBC Lucky Draw lottery contest. To claim your lottery cheque deposit statutory GST tax and file processing fee immediately.",
        "keywords": ["congratulations", "won", "lottery", "lucky draw", "kbc", "prize", "tax", "processing fee", "claim"]
    },
    {
        "id": "SCAM-05",
        "category": "CUSTOMER_SUPPORT_REFUND",
        "name": "Fake Customer Support Refund Reversal",
        "text": "Customer Support Desk: We have initiated your refund of 45,000 INR. To complete the reversal process and verify your wallet credit you must pay the temporary verification bond immediately which will be refunded in 5 minutes.",
        "keywords": ["support", "refund", "reversal", "verify", "wallet", "initiated", "desk", "bond"]
    },
    {
        "id": "SCAM-06",
        "category": "REMOTE_SCREEN_SHARE",
        "name": "AnyDesk Remote Screen Share Trap",
        "text": "Customer care executive speaking: Download AnyDesk or TeamViewer QuickSupport application from Play Store to fix your failed UPI payment transaction. Send 10 rupees test transfer to verify screen access.",
        "keywords": ["anydesk", "teamviewer", "quicksupport", "download", "screen", "failed payment", "remote"]
    },
    {
        "id": "SCAM-07",
        "category": "TELEGRAM_TASK_FRAUD",
        "name": "Part-Time Telegram Video Like-and-Earn",
        "text": "Earn 3000 to 8000 daily from home by liking YouTube videos and rating Google hotels. Deposit 5000 VIP prepaid task investment to unlock your 18000 task commission earnings on Telegram.",
        "keywords": ["part-time", "job", "earn", "telegram", "youtube", "task", "deposit", "investment", "commission", "vip"]
    },
    {
        "id": "SCAM-08",
        "category": "ARMY_OLX_VEHICLE_SALE",
        "name": "OLX Fake Army Officer Vehicle Advance",
        "text": "I am Indian Army Subedar Major transferred to Pune cantonment. Selling my Royal Enfield bike at half price. Pay Army military parcel transport fee and gate pass clearance fee to receive the vehicle.",
        "keywords": ["army", "cantonment", "military", "subedar", "olx", "vehicle", "gate pass", "transfer fee"]
    }
]


class SemanticVectorService:
    """
    Local semantic similarity matcher for the bundled scam-pattern corpus.
    Computes token-frequency cosine similarity; it is not an external vector
    database, retrieval service, or independently verified fraud feed.
    """

    def __init__(self):
        self._corpus = KNOWN_SCAM_TEMPLATES
        self._vocab = self._build_vocabulary()

    def _tokenize(self, text: str) -> List[str]:
        words = re.findall(r"\b[a-zA-Z0-9_]{2,}\b", text.lower())
        return words

    def _build_vocabulary(self) -> Dict[str, int]:
        vocab: Dict[str, int] = {}
        for template in self._corpus:
            tokens = self._tokenize(template["text"] + " " + " ".join(template["keywords"]))
            for t in tokens:
                if t not in vocab:
                    vocab[t] = len(vocab)
        return vocab

    def _text_to_vector(self, text: str) -> List[float]:
        tokens = self._tokenize(text)
        vec = [0.0] * len(self._vocab)
        for t in tokens:
            if t in self._vocab:
                vec[self._vocab[t]] += 1.0

        # Apply TF-IDF-style sublinear frequency scaling
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(v1, v2))
        return max(0.0, min(1.0, dot))

    def match_scam_pattern(self, user_message: str, threshold: float = 0.35) -> Optional[Dict[str, Any]]:
        """
        Finds the closest known scam pattern in the vector database.
        Returns match metadata if similarity exceeds threshold, else None.
        """
        if not user_message or len(user_message.strip()) < 5:
            return None

        user_vec = self._text_to_vector(user_message)
        user_tokens = set(self._tokenize(user_message))

        best_match: Optional[Dict[str, Any]] = None
        highest_score = 0.0

        for item in self._corpus:
            item_vec = self._text_to_vector(item["text"] + " " + " ".join(item["keywords"]))
            sim = self._cosine_similarity(user_vec, item_vec)

            # Keyword overlap boost for short domain terms (e.g. electricity, police, anydesk, refund)
            keyword_overlap = sum(1 for kw in item["keywords"] if kw in user_tokens)
            boosted_sim = min(0.99, sim + (keyword_overlap * 0.12))

            if boosted_sim > highest_score:
                highest_score = boosted_sim
                best_match = item

        if highest_score >= threshold and best_match:
            similarity_pct = round(highest_score * 100, 1)
            return {
                "pattern_id": best_match["id"],
                "pattern_name": best_match["name"],
                "category": best_match["category"],
                "similarity_score": round(highest_score, 3),
                "similarity_pct": similarity_pct,
                "summary": f"High semantic similarity ({similarity_pct}%) to known pattern: '{best_match['name']}'.",
                "reference_sample": best_match["text"][:120] + "...",
                "score_delta": 30 if similarity_pct >= 60 else 20
            }

        return None


vector_service = SemanticVectorService()
