"""
Trace router — public traceability endpoint for QR code scanning.
No authentication required.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.user import User
from models.batch import ProductBatch
from models.checkpoint import DistributionCheckpoint
from models.delivery_request import DeliveryRequest
from schemas.batch import TraceResponse, BatchResponse, CheckpointResponse

router = APIRouter(prefix="/trace", tags=["trace"])


@router.get("/{qr_hash}", response_model=TraceResponse)
async def get_trace(
    qr_hash: str,
    db: AsyncSession = Depends(get_db),
):
    """
    [PUBLIC] Get full traceability info for a product batch via QR hash.
    Consumers scan QR → see journey from farm to current location.
    Response must load in < 30 seconds (target: < 2s).
    """
    result = await db.execute(
        select(ProductBatch)
        .options(
            selectinload(ProductBatch.checkpoints),
            selectinload(ProductBatch.farmer),
            selectinload(ProductBatch.delivery_requests).selectinload(DeliveryRequest.distributor),
        )
        .where(ProductBatch.qr_code_hash == qr_hash)
    )
    batch = result.scalar_one_or_none()

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Produk tidak ditemukan. Pastikan QR Code valid.",
        )

    # Calculate journey duration
    total_hours = None
    if batch.checkpoints and len(batch.checkpoints) > 1:
        sorted_cp = sorted(batch.checkpoints, key=lambda c: c.scanned_at)
        delta = sorted_cp[-1].scanned_at - sorted_cp[0].scanned_at
        total_hours = round(delta.total_seconds() / 3600, 1)

    return TraceResponse(
        batch=BatchResponse.model_validate(batch),
        farmer_name=batch.farmer.name if batch.farmer else "Unknown",
        farm_region=batch.farmer.region if batch.farmer else None,
        checkpoints=[
            CheckpointResponse.model_validate(cp)
            for cp in sorted(batch.checkpoints, key=lambda c: c.scanned_at)
        ],
        total_journey_hours=total_hours,
    )
