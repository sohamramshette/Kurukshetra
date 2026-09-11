# Kurukshetra --- Payment Guardian (PS09)

> **Agentic Guardian for Real-Time Payment Scam Interception**
>
> Single Source of Truth: [`brain.md`](./brain.md)

---

## 3-Person Team Work Allocation

To work concurrently without Git merge conflicts, each team member is assigned dedicated directories:

| Teammate | Assigned Domain | Folder Boundaries | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Person 1** | **Frontend & UI/UX Lead** | `frontend/` | Payment simulator UI, Guardian alert intercept modal, live verification visualizer, security operator dashboard. |
| **Person 2** | **Backend Core, AI Agent & Tools Lead** *(Person 2 + Person 4)* | `backend/app/api/`<br>`backend/app/guardian/`<br>`backend/app/tools/`<br>`backend/app/services/`<br>`backend/app/main.py`<br>`backend/app/config.py` | • FastAPI server & endpoints (`/analyze`, `/confirm`, `/cancel`)<br>• Pre-payment interception state machine<br>• Guardian Agent reasoning loop (Observe → Reason → Verify → Reassess → Act)<br>• 6 verification tools (History, Recipient, Reputation, Scam detection, Identity, Velocity)<br>• Risk scoring engine & Decision policy<br>• Audit service & logging |
| **Person 3** | **Database, Schemas & Testing Lead** | `backend/app/models/`<br>`backend/app/schemas/`<br>`backend/tests/` | • Database setup (SQLite/PostgreSQL) & ORM models (`user`, `transaction`, `recipient`, `risk_event`, `decision`)<br>• Request & response validation schemas (`payment`, `risk`, `guardian`)<br>• Test scenarios & test suite (`tests/`) |

---

## Directory & File Structure (All Files 0 Bytes / Ready for Code)

```text
Kurukshetra/
├── brain.md                                (Single Source of Truth)
├── README.md                               (Team assignments & setup)
├── .gitignore
│
├── backend/                                (Person 2 & 3)
│   ├── app/
│   │   ├── main.py                         (Person 2)
│   │   ├── config.py                       (Person 2)
│   │   ├── api/                            (Person 2)
│   │   │   ├── payments.py
│   │   │   ├── guardian.py
│   │   │   ├── users.py
│   │   │   └── dashboard.py
│   │   ├── services/                       (Person 2)
│   │   │   ├── payment_service.py
│   │   │   └── audit_service.py
│   │   ├── guardian/                       (Person 2)
│   │   │   ├── agent.py
│   │   │   ├── planner.py
│   │   │   ├── risk_engine.py
│   │   │   ├── decision_engine.py
│   │   │   ├── explainability.py
│   │   │   └── intervention.py
│   │   ├── tools/                          (Person 2)
│   │   │   ├── transaction_history.py
│   │   │   ├── recipient_check.py
│   │   │   ├── reputation.py
│   │   │   ├── scam_detection.py
│   │   │   ├── identity_verification.py
│   │   │   └── velocity.py
│   │   │
│   │   ├── models/                         (Person 3)
│   │   │   ├── user.py
│   │   │   ├── transaction.py
│   │   │   ├── recipient.py
│   │   │   ├── risk_event.py
│   │   │   └── decision.py
│   │   ├── schemas/                        (Person 3)
│   │   │   ├── payment.py
│   │   │   ├── risk.py
│   │   │   └── guardian.py
│   │   └── tests/                          (Person 3)
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                               (Person 1)
    ├── src/
    │   ├── components/
    │   │   ├── PaymentForm.tsx
    │   │   ├── GuardianAlert.tsx
    │   │   ├── RiskBadge.tsx
    │   │   ├── EvidenceList.tsx
    │   │   ├── VerificationPanel.tsx
    │   │   ├── DecisionPanel.tsx
    │   │   └── SecurityTimeline.tsx
    │   ├── pages/
    │   │   ├── Payment.tsx
    │   │   ├── Guardian.tsx
    │   │   └── Dashboard.tsx
    │   ├── services/
    │   │   └── api.ts
    │   ├── hooks/
    │   │   └── useGuardian.ts
    │   ├── types/
    │   │   └── guardian.ts
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── .env.example
```

---

## Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
