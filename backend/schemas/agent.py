"""
Agent schemas — chat requests, agent health, and log responses.
"""

import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    """Optional user profile context to personalize AI responses."""
    name: Optional[str] = None
    role: Optional[str] = None
    region: Optional[str] = None
    farm_location: Optional[str] = None
    land_area: Optional[str] = None
    phone: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    user_context: Optional[UserContext] = None


class ChatResponse(BaseModel):
    reply: str
    agent_type: str
    model_used: str
    confidence: Optional[float] = None


class PriceRecommendationRequest(BaseModel):
    commodity_name: str
    region: str


class RouteRecommendationRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    batch_id: uuid.UUID


class RouteRecommendationResponse(BaseModel):
    recommended_route: str
    estimated_duration_min: float
    distance_km: float
    freshness_score: float = Field(description="0.0-1.0, estimated freshness at arrival")
    tips: List[str]


class AgentHealthResponse(BaseModel):
    agent_type: str
    status: str = Field(description="online | degraded | offline")
    primary_model: str
    fallback_model: str
    avg_latency_ms: Optional[float] = None
    total_calls_today: int = 0


class AgentLogResponse(BaseModel):
    id: uuid.UUID
    agent_type: str
    output_summary: Optional[str]
    tokens_used: Optional[int]
    latency_ms: Optional[int]
    model_used: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    alert_type: str
    severity: str
    message: str
    resolved_at: Optional[datetime]
    created_at: datetime
    # Context fields joined from batch + farmer
    commodity_name: Optional[str] = None
    farmer_name: Optional[str] = None

    model_config = {"from_attributes": True}
