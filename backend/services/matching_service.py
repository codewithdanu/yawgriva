"""
Matching Service — Feature 2: Farmer-Distributor Matching System.

Finds top 3 distributor candidates for a batch based on:
- Geographic proximity (40 points)
- Historical performance/freshness score (40 points)
- Current availability (20 points)

Scoring formula:
  distance_score    = (50 - distance_km) / 50 × 40   (max 50km radius)
  performance_score = avg_freshness_score_historis × 0.4
  availability      = 20 if no active batch, 0 otherwise
  MatchScore = distance_score + performance_score + availability
"""

import math
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional


@dataclass
class DistributorCandidate:
    distributor_id: str
    distributor_name: str
    distance_km: float
    match_score: float
    avg_freshness_score: Optional[float]
    total_deliveries: int
    is_available: bool  # True if no active batch currently
    # Calculated sub-scores
    distance_score: float
    performance_score: float
    availability_score: float


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance between two coordinates (km).
    Uses Haversine formula.
    """
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_match_score(
    distance_km: float,
    avg_freshness_score: Optional[float],
    is_available: bool,
    max_radius_km: float = 50.0,
) -> tuple[float, float, float, float]:
    """
    Calculate match score components.

    Returns:
        (total_score, distance_score, performance_score, availability_score)
    """
    # Distance score: max 40 points within 50km radius
    if distance_km > max_radius_km:
        distance_score = 0.0
    else:
        distance_score = ((max_radius_km - distance_km) / max_radius_km) * 40.0

    # Performance score: based on historical avg freshness (max 40 points)
    if avg_freshness_score is not None:
        performance_score = avg_freshness_score * 0.4
    else:
        performance_score = 20.0  # neutral score for new distributors

    # Availability: 20 points if no active batch
    availability_score = 20.0 if is_available else 0.0

    total = distance_score + performance_score + availability_score
    return round(total, 2), round(distance_score, 2), round(performance_score, 2), round(availability_score, 2)


async def find_match_candidates(
    batch_lat: float,
    batch_lon: float,
    batch_quantity_kg: float,
    db,
    max_radius_km: float = 50.0,
    top_n: int = 3,
) -> list[DistributorCandidate]:
    """
    Find top N distributor candidates for a batch.

    Args:
        batch_lat: batch origin latitude
        batch_lon: batch origin longitude
        batch_quantity_kg: batch weight (for capacity filter)
        db: AsyncSession
        max_radius_km: search radius
        top_n: number of top candidates to return

    Returns:
        List of DistributorCandidate sorted by match_score descending
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from models.user import User
    from models.batch import ProductBatch
    from models.delivery_request import DistributorPerformance

    # Fetch all active distributors with their profiles
    result = await db.execute(
        select(User)
        .where(User.role == "distributor")
        .options(selectinload(User.farmer_profile))
    )
    distributors = result.scalars().all()

    # Fetch performance records
    perf_result = await db.execute(select(DistributorPerformance))
    perf_map = {str(p.distributor_id): p for p in perf_result.scalars().all()}

    # Check active batches per distributor (to determine availability)
    active_result = await db.execute(
        select(ProductBatch.farmer_id).where(
            ProductBatch.status.in_(["registered", "in_transit"])
        )
    )
    # Note: track by the distributor who has accepted an active delivery request
    from models.delivery_request import DeliveryRequest
    active_dr_result = await db.execute(
        select(DeliveryRequest.distributor_id).where(
            DeliveryRequest.status == "accepted"
        )
    )
    busy_distributor_ids = {str(r[0]) for r in active_dr_result.all()}

    candidates = []
    for dist in distributors:
        # Need distributor's location — from farmer_profile or user metadata
        # For now, use farmer profile latitude/longitude if available
        # In production, distributors should have their own location profile
        dist_lat = None
        dist_lon = None

        # Try to get distributor location from their farmer profile if any
        if hasattr(dist, "farmer_profile") and dist.farmer_profile:
            dist_lat = float(dist.farmer_profile.latitude) if dist.farmer_profile.latitude else None
            dist_lon = float(dist.farmer_profile.longitude) if dist.farmer_profile.longitude else None

        # If no location data, use a default distance (less preferred)
        if dist_lat is None or dist_lon is None:
            distance_km = max_radius_km  # treat as edge of radius
        else:
            distance_km = haversine_distance(batch_lat, batch_lon, dist_lat, dist_lon)

        # Skip if outside radius
        if distance_km > max_radius_km:
            continue

        perf = perf_map.get(str(dist.id))
        avg_freshness = float(perf.avg_freshness_score) if perf and perf.avg_freshness_score else None
        total_deliveries = perf.total_deliveries if perf else 0
        is_available = str(dist.id) not in busy_distributor_ids

        total_score, d_score, p_score, a_score = calculate_match_score(
            distance_km, avg_freshness, is_available, max_radius_km
        )

        candidates.append(DistributorCandidate(
            distributor_id=str(dist.id),
            distributor_name=dist.name,
            distance_km=round(distance_km, 2),
            match_score=total_score,
            avg_freshness_score=avg_freshness,
            total_deliveries=total_deliveries,
            is_available=is_available,
            distance_score=d_score,
            performance_score=p_score,
            availability_score=a_score,
        ))

    # Sort by match_score descending, return top N
    candidates.sort(key=lambda c: c.match_score, reverse=True)
    return candidates[:top_n]
