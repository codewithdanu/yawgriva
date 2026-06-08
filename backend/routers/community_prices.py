"""
Community Prices router — Feature 5: Community Price Report.

Endpoints:
  POST /community-prices             — Submit price report (Farmer only)
  GET  /community-prices/{commodity} — View aggregate + official comparison
  GET  /community-prices/alerts      — Commodities with significant price gap
"""

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.community_price import CommunityPriceReport, CommunityPriceAggregate
from services.community_price_service import (
    aggregate_community_prices,
    detect_outlier,
)

router = APIRouter(prefix="/community-prices", tags=["community-prices"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class CommunityPriceSubmit(BaseModel):
    commodity_name: str = Field(..., max_length=100)
    price_per_kg: float = Field(..., gt=0)
    market_name: Optional[str] = Field(None, max_length=255)
    region: str = Field(..., max_length=100)
    transaction_type: str = Field(..., pattern="^(tengkulak|pasar|langsung)$")


class CommunityPriceReportResponse(BaseModel):
    id: uuid.UUID
    commodity_name: str
    price_per_kg: float
    market_name: Optional[str]
    region: str
    transaction_type: str
    status: str
    reporter_weight: float
    reported_at: datetime

    model_config = {"from_attributes": True}


class CommunityPriceAggregateResponse(BaseModel):
    commodity_name: str
    region: str
    community_price: Optional[float]
    official_price: Optional[float]
    gap_percent: Optional[float]
    report_count: int
    alert_level: str
    aggregated_for: date
    today_report_count: int  # How many reports submitted today (for social proof)


class PriceAlertResponse(BaseModel):
    commodity_name: str
    region: str
    gap_percent: float
    alert_level: str
    community_price: Optional[float]
    official_price: Optional[float]
    report_count: int


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=CommunityPriceReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_price_report(
    request: CommunityPriceSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Farmer submits today's actual price for a commodity."""
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Hanya petani yang dapat melaporkan harga")

    # Rate limit: one report per commodity per day per farmer
    today = date.today()
    existing = await db.execute(
        select(CommunityPriceReport).where(
            and_(
                CommunityPriceReport.reporter_id == current_user.id,
                CommunityPriceReport.commodity_name == request.commodity_name,
                func.date(CommunityPriceReport.reported_at) == today,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=429,
            detail=f"Anda sudah melaporkan harga {request.commodity_name} hari ini. Coba lagi besok.",
        )

    # Get existing prices today for outlier detection
    existing_prices_result = await db.execute(
        select(CommunityPriceReport.price_per_kg).where(
            and_(
                CommunityPriceReport.commodity_name == request.commodity_name,
                CommunityPriceReport.region == request.region,
                CommunityPriceReport.status == "validated",
                func.date(CommunityPriceReport.reported_at) == today,
            )
        )
    )
    existing_prices = [float(r[0]) for r in existing_prices_result.all()]

    # Layer 2: Outlier detection
    is_outlier = detect_outlier(request.price_per_kg, existing_prices)
    report_status = "suspect" if is_outlier else "validated"

    report = CommunityPriceReport(
        reporter_id=current_user.id,
        commodity_name=request.commodity_name,
        price_per_kg=request.price_per_kg,
        market_name=request.market_name,
        region=request.region,
        transaction_type=request.transaction_type,
        status=report_status,
        reporter_weight=1.0,  # Default weight; updated over time
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    return report


@router.get("/alerts", response_model=List[PriceAlertResponse])
async def get_price_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of commodities with significant price gap (medium or high alert)."""
    today = date.today()
    result = await db.execute(
        select(CommunityPriceAggregate).where(
            and_(
                CommunityPriceAggregate.aggregated_for == today,
                CommunityPriceAggregate.alert_level.in_(["medium", "high"]),
            )
        ).order_by(CommunityPriceAggregate.alert_level.desc())
    )
    aggregates = result.scalars().all()

    return [
        PriceAlertResponse(
            commodity_name=a.commodity_name,
            region=a.region,
            gap_percent=float(a.gap_percent) if a.gap_percent else 0.0,
            alert_level=a.alert_level,
            community_price=float(a.community_price) if a.community_price else None,
            official_price=float(a.official_price) if a.official_price else None,
            report_count=a.report_count,
        )
        for a in aggregates
    ]


@router.get("/{commodity}", response_model=CommunityPriceAggregateResponse)
async def get_commodity_aggregate(
    commodity: str,
    region: str = "Jawa",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get today's community price aggregate for a commodity + region."""
    today = date.today()

    # Try cached aggregate first
    cached = await db.execute(
        select(CommunityPriceAggregate).where(
            and_(
                CommunityPriceAggregate.commodity_name == commodity,
                CommunityPriceAggregate.region == region,
                CommunityPriceAggregate.aggregated_for == today,
            )
        ).order_by(CommunityPriceAggregate.created_at.desc()).limit(1)
    )
    cached_agg = cached.scalar_one_or_none()

    # Count today's reports (for social proof display)
    count_result = await db.execute(
        select(func.count(CommunityPriceReport.id)).where(
            and_(
                CommunityPriceReport.commodity_name == commodity,
                CommunityPriceReport.region == region,
                func.date(CommunityPriceReport.reported_at) == today,
            )
        )
    )
    today_count = count_result.scalar() or 0

    if cached_agg:
        return CommunityPriceAggregateResponse(
            commodity_name=cached_agg.commodity_name,
            region=cached_agg.region,
            community_price=float(cached_agg.community_price) if cached_agg.community_price else None,
            official_price=float(cached_agg.official_price) if cached_agg.official_price else None,
            gap_percent=float(cached_agg.gap_percent) if cached_agg.gap_percent else None,
            report_count=cached_agg.report_count,
            alert_level=cached_agg.alert_level,
            aggregated_for=cached_agg.aggregated_for,
            today_report_count=today_count,
        )

    # Compute on-demand
    agg = await aggregate_community_prices(commodity, region, today, db)
    if not agg:
        return CommunityPriceAggregateResponse(
            commodity_name=commodity,
            region=region,
            community_price=None,
            official_price=None,
            gap_percent=None,
            report_count=today_count,
            alert_level="normal",
            aggregated_for=today,
            today_report_count=today_count,
        )

    # Cache the result
    new_agg = CommunityPriceAggregate(
        commodity_name=agg.commodity,
        region=agg.region,
        community_price=agg.community_price,
        official_price=agg.official_price,
        gap_percent=agg.gap_percent,
        report_count=agg.report_count,
        alert_level=agg.alert_level,
        aggregated_for=agg.aggregated_for,
    )
    db.add(new_agg)
    await db.flush()

    return CommunityPriceAggregateResponse(
        commodity_name=agg.commodity,
        region=agg.region,
        community_price=agg.community_price,
        official_price=agg.official_price,
        gap_percent=agg.gap_percent,
        report_count=agg.report_count,
        alert_level=agg.alert_level,
        aggregated_for=agg.aggregated_for,
        today_report_count=today_count,
    )
