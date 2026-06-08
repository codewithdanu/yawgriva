# Yawgriva Backend API

The backend for Yawgriva is a high-performance Python application built on **FastAPI** and **SQLAlchemy Async**, utilizing **Celery** for background tasks and **PostgreSQL** as the primary datastore.

## Directory Structure

```text
├── agents/             # LangChain/AI agents (Anomaly, Price, Logistics, Orchestrator)
│   └── tools/          # Custom agent tools (Database, Maps, Price, Weather)
├── core/               # App configuration, security, database engines, and Redis sessions
├── migrations/         # Alembic database migrations
├── models/             # SQLAlchemy ORM declarations (User, Batch, Checkpoint, etc.)
├── routers/            # FastAPI controller endpoints (Auth, Checkpoint, Price, etc.)
├── schemas/            # Pydantic models for request/response serialization
├── scripts/            # Database utility scripts
├── services/           # Business logic modules (Carbon, Freshness, Vision, Storage)
├── workers/            # Celery worker tasks (Price scraping, anomalies, reports, AI)
├── main.py             # FastAPI entrypoint
└── seed.py             # Database seed script for development
```

---

## Local Installation (Without Docker)

If you prefer to run the backend natively for debugging, ensure Python 3.12+ is installed:

### 1. Create a Virtual Environment
```bash
python -m venv venv
# On Windows
.\venv\Scripts\activate
# On Linux/macOS
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Migrations & Seed
Ensure you have a PostgreSQL server running locally (mapped to the appropriate host in `.env`):
```bash
alembic upgrade head
python seed.py
```

### 4. Start the Application
Run the FastAPI development server:
```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
View the interactive API docs at `http://127.0.0.1:8000/docs`.

---

## Celery Background Workers

Background tasks are handled using Redis as the broker/backend.

### Running Celery Worker Locally:
```bash
# Set REDIS_HOST=localhost and REDIS_PORT=6380 if Redis is mapped to 6380
$env:REDIS_HOST="localhost"; $env:REDIS_PORT="6380"; celery -A workers.celery_app worker --loglevel=info
```

### Scheduled Tasks (Celery Beat):
Scheduled jobs are configured in `workers/celery_app.py`:
- **Anomaly Detection:** Runs every 30 minutes to scan active shipments.
- **Freshness Score Update:** Recalculates crop decay indices every 30 minutes.
- **Price Scraping:** Scheduled daily at 8:00 AM.
- **Weekly Report Generation:** Scheduled every Monday at 7:00 AM.
