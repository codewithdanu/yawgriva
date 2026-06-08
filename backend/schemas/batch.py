"""
Batch schemas — create, update status, and response for product batches.
"""

import uuid
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class BatchCreate(BaseModel):
    commodity_name: str = Field(..., max_length=100)
    quantity_kg: float = Field(..., gt=0)
    harvest_date: date


class BatchStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(registered|in_transit|delivered|sold)$")


class CheckpointCreate(BaseModel):
    batch_id: uuid.UUID
    location_name: str = Field(..., max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    temp_celsius: Optional[float] = None


class CheckpointResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    scanned_by: uuid.UUID
    location_name: str
    latitude: Optional[float]
    longitude: Optional[float]
    temp_celsius: Optional[float]
    scanned_at: datetime
    photo_url: Optional[str] = None
    visual_condition: Optional[str] = None
    visual_summary: Optional[str] = None
    visual_issues: Optional[List[str]] = None
    visual_confidence: Optional[float] = None

    model_config = {"from_attributes": True}


class BatchResponse(BaseModel):
    id: uuid.UUID
    farmer_id: uuid.UUID
    commodity_name: str
    quantity_kg: float
    harvest_date: date
    qr_code_hash: str
    status: str
    created_at: datetime
    checkpoints: Optional[List[CheckpointResponse]] = []
    distributor_name: Optional[str] = None
    match_score: Optional[float] = None
    freshness_score: Optional[float] = None
    total_distance_km: Optional[float] = None
    total_co2_kg: Optional[float] = None
    co2_saved_kg: Optional[float] = None
    vehicle_type: Optional[str] = None

    model_config = {"from_attributes": True}




class TraceResponse(BaseModel):
    """Public traceability response — no auth required."""
    batch: BatchResponse
    farmer_name: str
    farm_region: Optional[str]
    checkpoints: List[CheckpointResponse]
    total_journey_hours: Optional[float] = None
