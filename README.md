# Yawgriva: Horticultural Supply Chain & AI-Powered Price Intelligence

Yawgriva is a modern, full-stack logistics, cold-chain tracking, and price prediction system designed for horticultural supply chains. It empowers farmers with market transparency and provides distributors with secure tracking, carbon footprint estimation, and AI-powered produce quality inspection.

## Architecture Overview

Yawgriva uses a service-oriented, containerized architecture:

- **Frontend:** Next.js (App Router, Tailwind CSS, Leaflet Maps, TypeScript).
- **Backend:** FastAPI (Python 3.12, SQLAlchemy, Uvicorn, PostgreSQL).
- **Asynchronous Tasks:** Celery + Redis + Celery Beat (handling price scraping, anomaly detection, freshness updates, and AI vision tasks).
- **Object Storage:** MinIO (S3-compatible storage for checkpoint photos).
- **AI Intelligence:** Gemini 1.5/2.5 & OpenAI API for visual inspection of produce quality at checkpoints, route optimization, and price analytics.

---

## Key Features

1. **AI Visual produce Quality Inspection:** Upload photos at checkpoints. An asynchronous Celery task analyzes the produce condition (excellent/good/fair/poor/unknown) with Gemini Vision (or OpenAI GPT-4o fallback) and updates tracking statuses in real-time.
2. **Cold-Chain Tracking & Alerts:** Real-time temperature logs at logistics checkpoints. Compares temperatures against crop-specific thresholds (e.g., Tomat, Cabai) and alerts on temperature spikes.
3. **Partner Matching Engine:** Geo-spatial matching connecting farmers with nearby distributors based on harvest location and availability.
4. **Community Price Reports & Predictions:** Crowdsourced daily commodity prices with automatic outlier detection and AI price trend predictions.
5. **Carbon Footprint Tracking:** Automatic CO2 emission calculations based on transit distance and vehicle type (e.g., Mobil Boks).
6. **AI Logistics Agent Chat:** Conversational assistant for farmers to get route advice, weather checks, and price reports.

---

## Quick Start (Development)

Ensure you have **Docker Desktop** installed and running on your system.

### 1. Configure Environment Variables
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Fill in the required API keys (e.g., `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `GOOGLE_MAPS_API_KEY`).

### 2. Launch Services
Start all development containers:
```bash
docker compose up --build -d
```
This launches:
- **Frontend** at `http://localhost:3000`
- **Backend API** at `http://localhost:8000` (Docs at `/docs`)
- **MinIO Console** at `http://localhost:9001` (Storage at `http://localhost:9000`)
- **PostgreSQL Database** mapped to port `5433` (internal `5432`)
- **Redis** mapped to port `6380` (internal `6379`)
- **Celery Worker & Beat** for async jobs

### 3. Seed Mock Data
To populate the database with mock users, batches, pricing, and checkpoints:
```bash
docker compose exec backend python seed.py
```
**Default Credentials:**
- **Admin:** `admin@mail.com` / `admin123`
- **Distributor:** `distributor@mail.com` / `distrib123`
- **Farmer:** `budi@mail.com` / `farmer123`

---

## Production Deployment & CI/CD

Yawgriva includes an automated CI/CD pipeline in `.github/workflows/deploy.yml` that builds and deploys the stack to a VPS:

1. **Image Registry:** Builds production-optimized frontend and backend Docker images and pushes them to **GitHub Container Registry (GHCR)** (`ghcr.io`).
2. **VPS Deployment:** Copies [docker-compose.prod.yml](docker-compose.prod.yml) to the target server via SCP, logs into GHCR, pulls the new images, and restarts services with zero downtime.

To activate deployment, configure the following secrets in GitHub Repository Settings:
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`.

---

## License

This project is licensed under the MIT License.
