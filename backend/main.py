"""
Yawgriva Backend — FastAPI Entry Point

Single Python service handling REST API, authentication, AI agents,
and business logic for the Yawgriva horticultural supply chain platform.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import settings
from core.database import engine, Base
from routers import auth, batches, checkpoints, prices, trace, agents, admin
from routers import delivery_requests, community_prices, farmer_reports


limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: create tables if they don't exist (dev convenience)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Apply alters for existing tables to ensure new columns are added if they don't exist
        from sqlalchemy import text
        alters = [
            "ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS freshness_score NUMERIC(5, 2)",
            "ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS freshness_updated TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS total_distance_km NUMERIC(8, 2)",
            "ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS total_co2_kg NUMERIC(8, 3)",
            "ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS co2_saved_kg NUMERIC(8, 3)",
            "ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50)",
            "ALTER TABLE distribution_checkpoints ADD COLUMN IF NOT EXISTS photo_url TEXT",
            "ALTER TABLE distribution_checkpoints ADD COLUMN IF NOT EXISTS visual_condition VARCHAR(20)",
            "ALTER TABLE distribution_checkpoints ADD COLUMN IF NOT EXISTS visual_summary TEXT",
            "ALTER TABLE distribution_checkpoints ADD COLUMN IF NOT EXISTS visual_issues JSONB",
            "ALTER TABLE distribution_checkpoints ADD COLUMN IF NOT EXISTS visual_confidence NUMERIC(4, 3)",
        ]
        for query in alters:
            await conn.execute(text(query))
            
    # Initialize MinIO storage bucket on startup
    try:
        from services.storage_service import storage_service
        storage_service.ensure_bucket_exists()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error initializing storage bucket: {e}")
        
    yield
    # Shutdown: dispose engine
    await engine.dispose()


from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Yawgriva API",
    description="From Farm Data to Farm Decisions — Horticultural supply chain platform with AI agents",
    version="1.0.0",
    lifespan=lifespan,
)

# Create static directories if they don't exist
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(os.path.join(static_dir, "photos"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://frontend:3000",
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(batches.router, prefix="/api/v1")
app.include_router(checkpoints.router, prefix="/api/v1")
app.include_router(prices.router, prefix="/api/v1")
app.include_router(trace.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
# New feature routers
app.include_router(delivery_requests.router, prefix="/api/v1")
app.include_router(community_prices.router, prefix="/api/v1")
app.include_router(farmer_reports.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "yawgriva-backend"}
