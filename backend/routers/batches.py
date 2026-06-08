"""
Batches router — CRUD for product batches.
Farmers create batches; status updates during distribution.
New: freshness score, carbon footprint, and match-candidates endpoints.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.batch import ProductBatch
from models.delivery_request import DeliveryRequest
from schemas.batch import BatchCreate, BatchResponse, BatchStatusUpdate
from services.qr_service import QRService
from services.freshness_service import calculate_freshness_score, FreshnessResult
from services.carbon_service import calculate_carbon_footprint, CarbonResult, get_vehicle_options
from services.matching_service import find_match_candidates, DistributorCandidate

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("", response_model=List[BatchResponse])
async def list_batches(
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List batches. Farmers see own batches; distributors see all available."""
    query = select(ProductBatch).options(
        selectinload(ProductBatch.checkpoints),
        selectinload(ProductBatch.delivery_requests).selectinload(DeliveryRequest.distributor)
    )

    if current_user.role == "farmer":
        query = query.where(ProductBatch.farmer_id == current_user.id)
    elif current_user.role == "distributor":
        # Distributors see registered + in_transit batches
        if not status_filter:
            query = query.where(
                ProductBatch.status.in_(["registered", "in_transit"])
            )

    if status_filter:
        query = query.where(ProductBatch.status == status_filter)

    query = query.order_by(ProductBatch.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    request: BatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new product batch. Farmer only."""
    if current_user.role != "farmer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya petani yang bisa membuat batch",
        )

    qr_hash = QRService.generate_hash()

    batch = ProductBatch(
        farmer_id=current_user.id,
        commodity_name=request.commodity_name,
        quantity_kg=request.quantity_kg,
        harvest_date=request.harvest_date,
        qr_code_hash=qr_hash,
    )
    db.add(batch)
    await db.commit()

    # Re-fetch with eager-loaded relationships to avoid MissingGreenlet on checkpoints
    result = await db.execute(
        select(ProductBatch)
        .options(
            selectinload(ProductBatch.checkpoints),
            selectinload(ProductBatch.delivery_requests).selectinload(DeliveryRequest.distributor)
        )
        .where(ProductBatch.id == batch.id)
    )
    return result.scalar_one()


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single batch with its checkpoints."""
    result = await db.execute(
        select(ProductBatch)
        .options(
            selectinload(ProductBatch.checkpoints),
            selectinload(ProductBatch.delivery_requests).selectinload(DeliveryRequest.distributor)
        )
        .where(ProductBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    # Farmers can only see their own batches
    if current_user.role == "farmer" and batch.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    return batch


@router.patch("/{batch_id}/status", response_model=BatchResponse)
async def update_batch_status(
    batch_id: uuid.UUID,
    request: BatchStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update batch status. Valid transitions are tracked."""
    result = await db.execute(
        select(ProductBatch)
        .options(
            selectinload(ProductBatch.checkpoints),
            selectinload(ProductBatch.delivery_requests).selectinload(DeliveryRequest.distributor)
        )
        .where(ProductBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    batch.status = request.status
    await db.commit()
    return batch


# ──────────────────────────────────────────────────────────────────────────────
# Feature 1: Freshness Score
# ──────────────────────────────────────────────────────────────────────────────

class FreshnessResponse(BaseModel):
    batch_id: str
    score: float
    label: str
    label_color: str
    hours_elapsed: float
    shelf_life_hours: int
    time_decay: float
    temp_penalty: float
    delay_penalty: float


@router.get("/{batch_id}/freshness", response_model=FreshnessResponse)
async def get_batch_freshness(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate and return real-time freshness score for a batch."""
    result = await db.execute(
        select(ProductBatch)
        .options(selectinload(ProductBatch.checkpoints))
        .where(ProductBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    # Convert harvest_date to datetime
    from datetime import datetime, timezone
    harvest_dt = datetime(
        batch.harvest_date.year,
        batch.harvest_date.month,
        batch.harvest_date.day,
        tzinfo=timezone.utc,
    )

    freshness = calculate_freshness_score(
        commodity=batch.commodity_name,
        harvest_date=harvest_dt,
        checkpoints=batch.checkpoints,
    )

    # Persist updated score to DB
    batch.freshness_score = freshness.score
    batch.freshness_updated = datetime.now(timezone.utc)
    await db.flush()

    return FreshnessResponse(
        batch_id=str(batch_id),
        score=freshness.score,
        label=freshness.label,
        label_color=freshness.label_color,
        hours_elapsed=freshness.hours_elapsed,
        shelf_life_hours=freshness.shelf_life_hours,
        time_decay=freshness.time_decay,
        temp_penalty=freshness.temp_penalty,
        delay_penalty=freshness.delay_penalty,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Feature 6: Carbon Footprint
# ──────────────────────────────────────────────────────────────────────────────

class CarbonUpdateRequest(BaseModel):
    distance_km: float
    vehicle_type: str


class CarbonResponse(BaseModel):
    batch_id: str
    actual_kg_co2: float
    baseline_kg_co2: float
    saving_kg_co2: float
    saving_percent: float
    equivalent_trees: float
    distance_km: float
    vehicle_type: str
    quantity_kg: float
    summary_text: str  # Human-friendly summary


@router.get("/{batch_id}/carbon", response_model=CarbonResponse)
async def get_batch_carbon(
    batch_id: uuid.UUID,
    distance_km: float = Query(..., gt=0, description="Jarak pengiriman dalam km"),
    vehicle_type: str = Query("mobil_boks", description="Jenis kendaraan"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate carbon footprint for a batch delivery."""
    result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    carbon = calculate_carbon_footprint(
        distance_km=distance_km,
        vehicle_type=vehicle_type,
        quantity_kg=float(batch.quantity_kg),
    )

    # Persist to batch
    batch.total_distance_km = carbon.distance_km
    batch.total_co2_kg = carbon.actual_kg_co2
    batch.co2_saved_kg = carbon.saving_kg_co2
    batch.vehicle_type = vehicle_type
    await db.flush()

    summary = (
        f"Pengiriman ini menghasilkan {carbon.actual_kg_co2:.1f} kg CO₂. "
        f"Dengan rute optimal, kamu hemat {carbon.saving_kg_co2:.1f} kg CO₂ — "
        f"setara menanam {carbon.equivalent_trees:.2f} pohon."
    )

    return CarbonResponse(
        batch_id=str(batch_id),
        actual_kg_co2=carbon.actual_kg_co2,
        baseline_kg_co2=carbon.baseline_kg_co2,
        saving_kg_co2=carbon.saving_kg_co2,
        saving_percent=carbon.saving_percent,
        equivalent_trees=carbon.equivalent_trees,
        distance_km=carbon.distance_km,
        vehicle_type=carbon.vehicle_type,
        quantity_kg=carbon.quantity_kg,
        summary_text=summary,
    )


@router.get("/vehicle-types")
async def list_vehicle_types():
    """Return supported vehicle types for carbon calculation."""
    return get_vehicle_options()


# ──────────────────────────────────────────────────────────────────────────────
# Feature 2: Match Candidates
# ──────────────────────────────────────────────────────────────────────────────

class MatchCandidateResponse(BaseModel):
    distributor_id: str
    distributor_name: str
    distance_km: float
    match_score: float
    avg_freshness_score: Optional[float]
    total_deliveries: int
    is_available: bool
    distance_score: float
    performance_score: float
    availability_score: float


@router.get("/{batch_id}/match-candidates", response_model=List[MatchCandidateResponse])
async def get_match_candidates(
    batch_id: uuid.UUID,
    batch_lat: float = Query(..., description="Latitude titik asal batch"),
    batch_lon: float = Query(..., description="Longitude titik asal batch"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Find top 3 distributor candidates for a batch (Farmer only)."""
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Hanya petani yang dapat melihat kandidat distributor")

    result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    if batch.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    candidates = await find_match_candidates(
        batch_lat=batch_lat,
        batch_lon=batch_lon,
        batch_quantity_kg=float(batch.quantity_kg),
        db=db,
    )

    return [
        MatchCandidateResponse(
            distributor_id=c.distributor_id,
            distributor_name=c.distributor_name,
            distance_km=c.distance_km,
            match_score=c.match_score,
            avg_freshness_score=c.avg_freshness_score,
            total_deliveries=c.total_deliveries,
            is_available=c.is_available,
            distance_score=c.distance_score,
            performance_score=c.performance_score,
            availability_score=c.availability_score,
        )
        for c in candidates
    ]
