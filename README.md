# Kurukshetra --- Payment Guardian (PS09)

> **Agentic Guardian for Real-Time Payment Scam Interception**
>
> Single Source of Truth: [`brain.md`](./brain.md)

---

## 4-Person Team Work Allocation

To work concurrently without Git merge conflicts, each team member is assigned dedicated directories:

| Teammate | Assigned Domain | Folder Boundaries | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Person 1** | **Frontend & UI/UX** | `frontend/` | Payment simulator UI, Guardian alert intercept modal, live verification visualizer, security dashboard. |
| **Person 2** | **Backend API & Interception** | `backend/app/api/`<br>`backend/app/services/`<br>`backend/app/main.py` | FastAPI server, pre-payment interception state machine, endpoints (`/analyze`, `/confirm`, `/cancel`), audit log orchestration. |
| **Person 3** | **Database & Demo Data** | `backend/app/models/`<br>`backend/app/db/`<br>`backend/seeds/` | Database setup (SQLite/PostgreSQL), ORM schemas, test scenarios (Aarav Mehta, fake support scammer), query helpers. |
| **Person 4** | **AI Guardian Agent & Tools** | `backend/app/guardian/`<br>`backend/app/tools/` | Agent reasoning loop (Observe → Reason → Verify → Reassess → Act), 6 verification tools, risk engine, prompt injection defenses. |

---

## Quick Start

### 1. Backend Setup (FastAPI + Python)
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
Backend runs at: `http://localhost:8000`  
Swagger API Docs: `http://localhost:8000/docs`

### 2. Frontend Setup (React + TypeScript + Vite + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`
