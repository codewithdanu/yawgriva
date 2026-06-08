"""
Freshness Score Service — Feature 1.

Calculates a 0-100 freshness score for each product batch based on:
- Time elapsed since harvest (60 points)
- Temperature penalties at checkpoints (30 points)
- Delay penalties between checkpoints (10 points)

Score thresholds:
  >= 80 : "Sangat Segar" (green)
  60-79 : "Segar" (yellow)
  40-59 : "Perlu Perhatian" (orange)
  < 40  : "Segera Distribusikan" (red)
"""

from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Optional

# Shelf life in hours per commodity
COMMODITY_SHELF_LIFE_HOURS: dict[str, int] = {
    "kangkung": 12,
    "bayam": 12,
    "tomat": 72,
    "cabai_merah": 120,
    "cabai_rawit": 96,
    "bawang_merah": 480,
    "bawang_putih": 720,
    "default": 48,
}

# Safe temperature ranges (min, max) in Celsius
SAFE_TEMP_RANGES: dict[str, tuple[float, float]] = {
    "kangkung": (10, 22),
    "tomat": (12, 20),
    "cabai_merah": (8, 18),
    "default": (10, 25),
}


@dataclass
class FreshnessResult:
    score: float
    label: str
    label_color: str  # "green" | "yellow" | "orange" | "red"
    hours_elapsed: float
    shelf_life_hours: int
    time_decay: float
    temp_penalty: float
    delay_penalty: float


def get_freshness_label(score: float) -> tuple[str, str]:
    """Return (label, color) based on score."""
    if score >= 80:
        return "Sangat Segar", "green"
    elif score >= 60:
        return "Segar", "yellow"
    elif score >= 40:
        return "Perlu Perhatian", "orange"
    else:
        return "Segera Distribusikan", "red"


def calculate_freshness_score(
    commodity: str,
    harvest_date: datetime,
    checkpoints: list,
) -> FreshnessResult:
    """
    Calculate freshness score for a batch.

    Args:
        commodity: commodity name (lowercase, underscore format)
        harvest_date: datetime when harvested
        checkpoints: list of DistributionCheckpoint objects with scanned_at and temp_celsius

    Returns:
        FreshnessResult with score and breakdown
    """
    # Normalize commodity name
    commodity_key = commodity.lower().replace(" ", "_").replace("-", "_")
    shelf_life = COMMODITY_SHELF_LIFE_HOURS.get(
        commodity_key, COMMODITY_SHELF_LIFE_HOURS["default"]
    )

    # Ensure harvest_date is timezone-aware
    now = datetime.now(timezone.utc)
    if harvest_date.tzinfo is None:
        harvest_date = harvest_date.replace(tzinfo=timezone.utc)

    hours_elapsed = (now - harvest_date).total_seconds() / 3600

    # Component 1: Time decay — up to 60 points
    time_decay = min(60.0, (hours_elapsed / shelf_life) * 60.0)

    # Component 2: Temperature penalty — up to 30 points
    safe_min, safe_max = SAFE_TEMP_RANGES.get(commodity_key, SAFE_TEMP_RANGES["default"])
    temp_penalty = 0.0
    for cp in checkpoints:
        if hasattr(cp, "temp_celsius") and cp.temp_celsius is not None:
            temp = float(cp.temp_celsius)
            if temp < safe_min or temp > safe_max:
                excess = max(safe_min - temp, temp - safe_max)
                temp_penalty += min(excess * 2, 10)
    temp_penalty = min(temp_penalty, 30.0)

    # Component 3: Delay penalty — up to 10 points
    delay_penalty = 0.0
    sorted_cps = sorted(checkpoints, key=lambda c: c.scanned_at)
    if len(sorted_cps) > 1:
        expected_gap = shelf_life / max(len(sorted_cps), 2)
        for i in range(1, len(sorted_cps)):
            cp_prev = sorted_cps[i - 1]
            cp_curr = sorted_cps[i]
            prev_at = cp_prev.scanned_at
            curr_at = cp_curr.scanned_at
            if prev_at.tzinfo is None:
                prev_at = prev_at.replace(tzinfo=timezone.utc)
            if curr_at.tzinfo is None:
                curr_at = curr_at.replace(tzinfo=timezone.utc)
            gap_hours = (curr_at - prev_at).total_seconds() / 3600
            if gap_hours > expected_gap * 1.5:
                delay_penalty += 5
    delay_penalty = min(delay_penalty, 10.0)

    score = max(0.0, round(100.0 - time_decay - temp_penalty - delay_penalty, 1))
    label, color = get_freshness_label(score)

    return FreshnessResult(
        score=score,
        label=label,
        label_color=color,
        hours_elapsed=round(hours_elapsed, 1),
        shelf_life_hours=shelf_life,
        time_decay=round(time_decay, 1),
        temp_penalty=round(temp_penalty, 1),
        delay_penalty=round(delay_penalty, 1),
    )
