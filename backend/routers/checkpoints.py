"""
Checkpoints router — scan QR codes at distribution points.
Feature 3: Photo upload + AI visual analysis endpoint added.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.batch import ProductBatch
from models.checkpoint import DistributionCheckpoint
from schemas.batch import CheckpointCreate, CheckpointResponse
from services.vision_service import MAX_IMAGE_SIZE_BYTES

router = APIRouter(prefix="/checkpoints", tags=["checkpoints"])

MAX_PHOTOS_PER_BATCH = 3


@router.post("", response_model=CheckpointResponse, status_code=status.HTTP_201_CREATED)
async def create_checkpoint(
    request: CheckpointCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a checkpoint scan — distributor scans QR at a location."""
    # Verify batch exists
    result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == request.batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")

    # Auto-update status to in_transit if still registered
    if batch.status == "registered":
        batch.status = "in_transit"

    checkpoint = DistributionCheckpoint(
        batch_id=request.batch_id,
        scanned_by=current_user.id,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        temp_celsius=request.temp_celsius,
    )
    db.add(checkpoint)
    await db.flush()
    return checkpoint


# ─────────────────────────────────────────────────────────────────────────────
# Feature 3: Photo Upload + Visual Analysis
# ─────────────────────────────────────────────────────────────────────────────

class VisualAnalysisResponse(BaseModel):
    checkpoint_id: str
    photo_url: Optional[str]
    visual_condition: Optional[str]
    condition_id: Optional[str]
    visual_summary: Optional[str]
    visual_issues: Optional[list]
    visual_confidence: Optional[float]
    condition_color: Optional[str]


@router.post("/{checkpoint_id}/photo", response_model=VisualAnalysisResponse)
async def upload_checkpoint_photo(
    checkpoint_id: uuid.UUID,
    photo: UploadFile = File(..., description="Foto kondisi produk (max 5MB, jpg/png)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a product condition photo for a checkpoint.
    Triggers Gemini Vision analysis automatically.
    Photo is optional — this endpoint never blocks checkpoint flow.
    Max 3 photos per batch.
    """
    if current_user.role not in ("distributor", "admin"):
        raise HTTPException(status_code=403, detail="Hanya distributor yang dapat upload foto kondisi")

    # Verify checkpoint exists
    result = await db.execute(
        select(DistributionCheckpoint).where(DistributionCheckpoint.id == checkpoint_id)
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint tidak ditemukan")

    # Count existing photos for this batch
    photo_count_result = await db.execute(
        select(DistributionCheckpoint).where(
            DistributionCheckpoint.batch_id == cp.batch_id,
            DistributionCheckpoint.photo_url.isnot(None),
        )
    )
    existing_with_photos = photo_count_result.scalars().all()
    if len(existing_with_photos) >= MAX_PHOTOS_PER_BATCH:
        raise HTTPException(
            status_code=429,
            detail=f"Batas maksimal {MAX_PHOTOS_PER_BATCH} foto per batch sudah tercapai",
        )

    # Read and validate file size
    image_bytes = await photo.read()
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran foto melebihi batas 5MB")

    # Get commodity for context
    batch_result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == cp.batch_id)
    )
    batch = batch_result.scalar_one_or_none()
    commodity = batch.commodity_name if batch else "unknown"

    # Upload photo to MinIO Object Storage
    import os
    from services.storage_service import storage_service
    
    safe_filename = os.path.basename(photo.filename)
    storage_key = f"checkpoints/{checkpoint_id}/{safe_filename}"
    
    try:
        photo_url = storage_service.upload_file(
            file_bytes=image_bytes,
            filename=storage_key,
            content_type=photo.content_type or "image/jpeg"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengunggah foto ke penyimpanan: {str(e)}")

    # Update checkpoint with pending status and photo url immediately
    cp.photo_url = photo_url
    cp.visual_condition = None
    cp.visual_summary = "Sedang menganalisis foto..."
    cp.visual_issues = []
    cp.visual_confidence = 0.0
    await db.flush()

    # Trigger async visual analysis Celery task
    from workers.vision_worker import analyze_checkpoint_photo_task
    analyze_checkpoint_photo_task.delay(str(checkpoint_id), storage_key, commodity)

    return VisualAnalysisResponse(
        checkpoint_id=str(checkpoint_id),
        photo_url=photo_url,
        visual_condition=None,
        condition_id=None,
        visual_summary="Sedang menganalisis foto...",
        visual_issues=[],
        visual_confidence=0.0,
        condition_color="gray",
    )


@router.get("/{checkpoint_id}/photo", response_model=VisualAnalysisResponse)
async def get_checkpoint_photo(
    checkpoint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get photo URL and visual analysis result for a checkpoint (public)."""
    result = await db.execute(
        select(DistributionCheckpoint).where(DistributionCheckpoint.id == checkpoint_id)
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint tidak ditemukan")

    condition_colors = {
        "excellent": "green",
        "good": "blue",
        "fair": "orange",
        "poor": "red",
    }

    return VisualAnalysisResponse(
        checkpoint_id=str(checkpoint_id),
        photo_url=cp.photo_url,
        visual_condition=cp.visual_condition,
        condition_id=None,
        visual_summary=cp.visual_summary,
        visual_issues=cp.visual_issues if cp.visual_issues else [],
        visual_confidence=float(cp.visual_confidence) if cp.visual_confidence else None,
        condition_color=condition_colors.get(cp.visual_condition or "", "gray"),
    )


@router.post("/{checkpoint_id}/reanalyze", response_model=VisualAnalysisResponse)
async def reanalyze_checkpoint_photo(
    checkpoint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Re-trigger Gemini Vision analysis for an existing checkpoint photo.
    """
    if current_user.role not in ("distributor", "admin"):
        raise HTTPException(status_code=403, detail="Hanya distributor yang dapat menganalisis ulang foto")

    # Verify checkpoint exists
    result = await db.execute(
        select(DistributionCheckpoint).where(DistributionCheckpoint.id == checkpoint_id)
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint tidak ditemukan")

    if not cp.photo_url:
        raise HTTPException(status_code=400, detail="Tidak ada foto untuk dianalisis ulang")

    # Extract storage key from photo_url
    from urllib.parse import urlparse
    parsed_url = urlparse(cp.photo_url)
    path_parts = parsed_url.path.strip("/").split("/")
    if path_parts and path_parts[0] == "checkpoint-photos":
        path_parts = path_parts[1:]
    storage_key = "/".join(path_parts)

    # Get commodity for context
    batch_result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == cp.batch_id)
    )
    batch = batch_result.scalar_one_or_none()
    commodity = batch.commodity_name if batch else "unknown"

    # Reset visual condition fields to pending
    cp.visual_condition = None
    cp.visual_summary = "Sedang menganalisis foto..."
    cp.visual_issues = []
    cp.visual_confidence = 0.0
    await db.flush()

    # Trigger async visual analysis Celery task
    from workers.vision_worker import analyze_checkpoint_photo_task
    analyze_checkpoint_photo_task.delay(str(checkpoint_id), storage_key, commodity)

    return VisualAnalysisResponse(
        checkpoint_id=str(checkpoint_id),
        photo_url=cp.photo_url,
        visual_condition=None,
        condition_id=None,
        visual_summary="Sedang menganalisis foto...",
        visual_issues=[],
        visual_confidence=0.0,
        condition_color="gray",
    )
