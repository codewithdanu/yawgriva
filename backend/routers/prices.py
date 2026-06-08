"""
Prices router — commodity prices and AI predictions.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.price import CommodityPrice, PricePrediction
from schemas.price import PriceResponse, PricePredictionResponse

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/{commodity}", response_model=List[PriceResponse])
async def get_commodity_prices(
    commodity: str,
    market: str | None = Query(None),
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get latest price data for a commodity from cached sources."""
    query = (
        select(CommodityPrice)
        .where(CommodityPrice.commodity_name == commodity)
        .order_by(CommodityPrice.recorded_at.desc())
        .limit(limit)
    )

    if market:
        query = query.where(CommodityPrice.market_name == market)

    result = await db.execute(query)
    prices = result.scalars().all()

    if not prices:
        raise HTTPException(
            status_code=404,
            detail=f"Belum ada data harga untuk {commodity}",
        )

    return prices


@router.get("/{commodity}/predict", response_model=List[PricePredictionResponse])
async def get_price_predictions(
    commodity: str,
    region: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Get AI-generated price predictions for a commodity in a region."""
    result = await db.execute(
        select(PricePrediction)
        .where(
            PricePrediction.commodity_name == commodity,
            PricePrediction.region == region,
        )
        .order_by(PricePrediction.predicted_for.asc())
        .limit(14)  # 14-day horizon
    )
    predictions = result.scalars().all()

    if not predictions:
        raise HTTPException(
            status_code=404,
            detail=f"Belum ada prediksi harga untuk {commodity} di {region}",
        )

    return predictions
