"""
Price schemas — commodity prices and prediction responses.
"""

import uuid
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class PriceResponse(BaseModel):
    id: uuid.UUID
    commodity_name: str
    market_name: str
    price_per_kg: float
    recorded_at: datetime
    source: str

    model_config = {"from_attributes": True}


class PricePredictionResponse(BaseModel):
    id: uuid.UUID
    commodity_name: str
    region: str
    predicted_price: float
    confidence: float
    predicted_for: date
    generated_at: datetime

    model_config = {"from_attributes": True}


class PriceTrendResponse(BaseModel):
    commodity_name: str
    region: str
    current_price: Optional[float]
    predictions: List[PricePredictionResponse]
    trend: str = Field(description="naik | turun | stabil")
    recommendation: Optional[str] = None
