"""
Community Price Service — Feature 5: Community Price Report.

Handles farmer-submitted price reports with 3-layer validation:
  Layer 1: Rate limiting (Redis, 1 report per commodity per farmer per day)
  Layer 2: Outlier detection (reject if > 3σ from median)
  Layer 3: Reporter weight (0.5–1.5 based on historical accuracy)

Aggregation uses weighted median for robustness against outliers.
"""

import statistics
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional


@dataclass
class CommunityPriceAggregate:
    commodity: str
    region: str
    community_price: float
    official_price: Optional[float]
    gap_percent: Optional[float]
    report_count: int
    alert_level: str  # "normal" | "medium" | "high"
    aggregated_for: date


def calculate_weighted_median(prices: list[float], weights: list[float]) -> float:
    """
    Calculate weighted median — more robust than weighted mean for outliers.

    Args:
        prices: list of price values
        weights: corresponding weights

    Returns:
        weighted median price
    """
    if not prices:
        return 0.0

    # Sort by price value
    sorted_pairs = sorted(zip(prices, weights), key=lambda x: x[0])
    total_weight = sum(w for _, w in sorted_pairs)

    cumulative = 0.0
    for price, weight in sorted_pairs:
        cumulative += weight
        if cumulative >= total_weight / 2:
            return price

    return sorted_pairs[-1][0]


def detect_outlier(
    price: float,
    existing_prices: list[float],
    std_multiplier: float = 3.0,
) -> bool:
    """
    Check if a price is an outlier (beyond std_multiplier * std_dev from median).

    Returns:
        True if the price is an outlier (should be flagged as 'suspect')
    """
    if len(existing_prices) < 3:
        return False  # Not enough data to determine outlier

    median = statistics.median(existing_prices)
    try:
        std = statistics.stdev(existing_prices)
    except statistics.StatisticsError:
        return False

    if std == 0:
        return False

    deviation = abs(price - median) / std
    return deviation > std_multiplier


async def aggregate_community_prices(
    commodity: str,
    region: str,
    report_date: date,
    db,
) -> Optional[CommunityPriceAggregate]:
    """
    Compute daily aggregate for a commodity + region.
    Requires at least 3 validated reports.

    Returns:
        CommunityPriceAggregate or None if insufficient data
    """
    from sqlalchemy import select, and_, func
    from models.community_price import CommunityPriceReport, CommunityPriceAggregate as DBAggregate
    from models.price import CommodityPrice

    # Get validated reports for today
    result = await db.execute(
        select(CommunityPriceReport).where(
            and_(
                CommunityPriceReport.commodity_name == commodity,
                CommunityPriceReport.region == region,
                CommunityPriceReport.status == "validated",
                func.date(CommunityPriceReport.reported_at) == report_date,
            )
        )
    )
    reports = result.scalars().all()

    if len(reports) < 3:
        return None  # Not enough data for meaningful aggregation

    prices = [float(r.price_per_kg) for r in reports]
    weights = [float(r.reporter_weight) for r in reports]
    weighted_med = calculate_weighted_median(prices, weights)

    # Get official price for comparison
    official_price_result = await db.execute(
        select(CommodityPrice.price_per_kg)
        .where(CommodityPrice.commodity_name == commodity)
        .order_by(CommodityPrice.recorded_at.desc())
        .limit(1)
    )
    official_price_row = official_price_result.scalar_one_or_none()
    official_price = float(official_price_row) if official_price_row else None

    if official_price and official_price > 0:
        gap_percent = ((official_price - weighted_med) / official_price) * 100
        alert_level = (
            "high" if abs(gap_percent) > 30 else
            "medium" if abs(gap_percent) > 15 else
            "normal"
        )
    else:
        gap_percent = None
        alert_level = "normal"

    return CommunityPriceAggregate(
        commodity=commodity,
        region=region,
        community_price=round(weighted_med, 2),
        official_price=round(official_price, 2) if official_price else None,
        gap_percent=round(gap_percent, 2) if gap_percent is not None else None,
        report_count=len(reports),
        alert_level=alert_level,
        aggregated_for=report_date,
    )


async def check_rate_limit(reporter_id: str, commodity: str, redis_client) -> bool:
    """
    Check if this farmer has already submitted a report for this commodity today.
    Uses Redis with 24h TTL.

    Returns:
        True if rate limit NOT exceeded (allowed to submit)
        False if rate limit exceeded (block submission)
    """
    if redis_client is None:
        return True  # If Redis not available, allow (graceful degradation)

    key = f"community_price:{reporter_id}:{commodity}:{date.today().isoformat()}"
    exists = await redis_client.exists(key)
    return not bool(exists)


async def mark_rate_limit(reporter_id: str, commodity: str, redis_client):
    """Mark that this farmer has submitted a report for this commodity today."""
    if redis_client is None:
        return

    key = f"community_price:{reporter_id}:{commodity}:{date.today().isoformat()}"
    await redis_client.setex(key, 86400, "1")  # TTL: 24 hours
