"""
Delivery Requests router — Feature 2: Farmer-Distributor Matching System.

Endpoints:
  POST  /delivery-requests              — Farmer sends request to distributor
  GET   /delivery-requests/incoming     — Distributor sees incoming requests
  PATCH /delivery-requests/{id}/accept  — Distributor accepts
  PATCH /delivery-requests/{id}/decline — Distributor declines
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.delivery_request import DeliveryRequest
from models.batch import ProductBatch

router = APIRouter(prefix="/delivery-requests", tags=["delivery-requests"])

REQUEST_EXPIRY_HOURS = 2  # Auto-expire after 2 hours


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class DeliveryRequestCreate(BaseModel):
    batch_id: uuid.UUID
    distributor_id: uuid.UUID
    match_score: Optional[float] = None


class DeliveryRequestResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    distributor_id: uuid.UUID
    match_score: Optional[float]
    status: str
    expires_at: Optional[datetime]
    created_at: datetime
    # Enriched fields
    commodity_name: Optional[str] = None
    quantity_kg: Optional[float] = None
    distributor_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=DeliveryRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery_request(
    request: DeliveryRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Farmer sends a delivery request to a distributor."""
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Hanya petani yang dapat mengirim permintaan pengiriman")

    # Verify batch belongs to this farmer
    batch_result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == request.batch_id)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch tidak ditemukan")
    if batch.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Batch bukan milik Anda")

    # Verify distributor exists
    dist_result = await db.execute(
        select(User).where(User.id == request.distributor_id, User.role == "distributor")
    )
    distributor = dist_result.scalar_one_or_none()
    if not distributor:
        raise HTTPException(status_code=404, detail="Distributor tidak ditemukan")

    # Check no pending request already exists for this batch + distributor
    existing = await db.execute(
        select(DeliveryRequest).where(
            DeliveryRequest.batch_id == request.batch_id,
            DeliveryRequest.distributor_id == request.distributor_id,
            DeliveryRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Permintaan sudah dikirim ke distributor ini")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=REQUEST_EXPIRY_HOURS)

    dr = DeliveryRequest(
        batch_id=request.batch_id,
        distributor_id=request.distributor_id,
        match_score=request.match_score,
        status="pending",
        expires_at=expires_at,
    )
    db.add(dr)
    await db.flush()
    await db.refresh(dr)

    return DeliveryRequestResponse(
        id=dr.id,
        batch_id=dr.batch_id,
        distributor_id=dr.distributor_id,
        match_score=float(dr.match_score) if dr.match_score else None,
        status=dr.status,
        expires_at=dr.expires_at,
        created_at=dr.created_at,
        commodity_name=batch.commodity_name,
        quantity_kg=float(batch.quantity_kg),
        distributor_name=distributor.name,
    )


@router.get("", response_model=List[DeliveryRequestResponse])
async def get_delivery_requests(
    batch_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List delivery requests. Farmers see sent requests, optional filter by batch_id."""
    query = select(DeliveryRequest)
    if current_user.role == "farmer":
        # Get batches of this farmer
        batch_ids_query = select(ProductBatch.id).where(ProductBatch.farmer_id == current_user.id)
        query = query.where(DeliveryRequest.batch_id.in_(batch_ids_query))
    elif current_user.role == "distributor":
        query = query.where(DeliveryRequest.distributor_id == current_user.id)

    if batch_id:
        query = query.where(DeliveryRequest.batch_id == batch_id)

    query = query.order_by(DeliveryRequest.created_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()

    responses = []
    for dr in requests:
        batch_result = await db.execute(
            select(ProductBatch).where(ProductBatch.id == dr.batch_id)
        )
        batch = batch_result.scalar_one_or_none()

        distributor_result = await db.execute(
            select(User).where(User.id == dr.distributor_id)
        )
        distributor = distributor_result.scalar_one_or_none()

        responses.append(DeliveryRequestResponse(
            id=dr.id,
            batch_id=dr.batch_id,
            distributor_id=dr.distributor_id,
            match_score=float(dr.match_score) if dr.match_score else None,
            status=dr.status,
            expires_at=dr.expires_at,
            created_at=dr.created_at,
            commodity_name=batch.commodity_name if batch else None,
            quantity_kg=float(batch.quantity_kg) if batch else None,
            distributor_name=distributor.name if distributor else None,
        ))

    return responses


@router.get("/incoming", response_model=List[DeliveryRequestResponse])
async def get_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Distributor views incoming pending delivery requests."""
    if current_user.role != "distributor":
        raise HTTPException(status_code=403, detail="Hanya distributor yang dapat melihat permintaan masuk")

    result = await db.execute(
        select(DeliveryRequest)
        .where(
            DeliveryRequest.distributor_id == current_user.id,
            DeliveryRequest.status == "pending",
        )
        .order_by(DeliveryRequest.created_at.desc())
    )
    requests = result.scalars().all()

    # Enrich with batch data
    responses = []
    for dr in requests:
        batch_result = await db.execute(
            select(ProductBatch).where(ProductBatch.id == dr.batch_id)
        )
        batch = batch_result.scalar_one_or_none()

        responses.append(DeliveryRequestResponse(
            id=dr.id,
            batch_id=dr.batch_id,
            distributor_id=dr.distributor_id,
            match_score=float(dr.match_score) if dr.match_score else None,
            status=dr.status,
            expires_at=dr.expires_at,
            created_at=dr.created_at,
            commodity_name=batch.commodity_name if batch else None,
            quantity_kg=float(batch.quantity_kg) if batch else None,
            distributor_name=current_user.name,
        ))

    return responses


@router.patch("/{request_id}/accept", response_model=DeliveryRequestResponse)
async def accept_delivery_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Distributor accepts a pending delivery request."""
    if current_user.role != "distributor":
        raise HTTPException(status_code=403, detail="Hanya distributor yang dapat menerima permintaan")

    result = await db.execute(
        select(DeliveryRequest).where(DeliveryRequest.id == request_id)
    )
    dr = result.scalar_one_or_none()
    if not dr:
        raise HTTPException(status_code=404, detail="Permintaan tidak ditemukan")
    if dr.distributor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permintaan bukan untuk Anda")
    if dr.status != "pending":
        raise HTTPException(status_code=409, detail=f"Permintaan sudah '{dr.status}'")

    # Check if not expired
    if dr.expires_at and dr.expires_at < datetime.now(timezone.utc):
        dr.status = "expired"
        await db.flush()
        raise HTTPException(status_code=410, detail="Permintaan sudah kedaluwarsa")

    dr.status = "accepted"

    # Update batch status to in_transit
    batch_result = await db.execute(
        select(ProductBatch).where(ProductBatch.id == dr.batch_id)
    )
    batch = batch_result.scalar_one_or_none()
    if batch:
        batch.status = "in_transit"

    await db.flush()
    return dr


@router.patch("/{request_id}/decline", response_model=DeliveryRequestResponse)
async def decline_delivery_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Distributor declines a pending delivery request."""
    if current_user.role != "distributor":
        raise HTTPException(status_code=403, detail="Hanya distributor yang dapat menolak permintaan")

    result = await db.execute(
        select(DeliveryRequest).where(DeliveryRequest.id == request_id)
    )
    dr = result.scalar_one_or_none()
    if not dr:
        raise HTTPException(status_code=404, detail="Permintaan tidak ditemukan")
    if dr.distributor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permintaan bukan untuk Anda")
    if dr.status != "pending":
        raise HTTPException(status_code=409, detail=f"Permintaan sudah '{dr.status}'")

    dr.status = "declined"
    await db.flush()
    return dr
