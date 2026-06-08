"""
Freshness Score Worker — Feature 1.

Runs every 30 minutes to recalculate freshness scores for all active batches.
Also checks for LOW_FRESHNESS anomalies and triggers alerts.
"""

import asyncio
import logging
from datetime import datetime, timezone

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _update_all_freshness_scores():
    """Update freshness scores for all active (in_transit) batches."""
    from core.database import async_session_factory
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from models.batch import ProductBatch
    from services.freshness_service import calculate_freshness_score

    async with async_session_factory() as db:
        # Only update active batches
        result = await db.execute(
            select(ProductBatch)
            .options(selectinload(ProductBatch.checkpoints))
            .where(ProductBatch.status.in_(["registered", "in_transit"]))
        )
        batches = result.scalars().all()

        updated = 0
        for batch in batches:
            try:
                harvest_dt = datetime(
                    batch.harvest_date.year,
                    batch.harvest_date.month,
                    batch.harvest_date.day,
                    tzinfo=timezone.utc,
                )
                freshness = calculate_freshness_score(
                    commodity=batch.commodity_name,
                    harvest_date=harvest_dt,
                    checkpoints=batch.checkpoints,
                )
                batch.freshness_score = freshness.score
                batch.freshness_updated = datetime.now(timezone.utc)
                updated += 1

                # Check for low freshness alert (score < 40)
                if freshness.score < 40:
                    await _maybe_create_freshness_alert(db, batch, freshness.score)

            except Exception as e:
                logger.error(f"Failed to update freshness for batch {batch.id}: {e}")

        await db.commit()
        logger.info(f"Updated freshness scores for {updated} batches")


async def _maybe_create_freshness_alert(db, batch, score: float):
    """Create a LOW_FRESHNESS anomaly alert if one doesn't already exist today."""
    from sqlalchemy import select, and_, func
    from models.alert import AnomalyAlert
    from datetime import date

    # Check if we already sent an alert today
    today = date.today()
    existing = await db.execute(
        select(AnomalyAlert).where(
            and_(
                AnomalyAlert.batch_id == batch.id,
                AnomalyAlert.alert_type == "LOW_FRESHNESS",
                func.date(AnomalyAlert.created_at) == today,
            )
        )
    )
    if existing.scalar_one_or_none():
        return  # Already alerted today

    severity = "high" if score < 25 else "medium"
    message = (
        f"Freshness score batch {batch.commodity_name} ({batch.quantity_kg} kg) "
        f"sudah turun ke {score:.0f}. "
        f"{'Segera distribusikan sebelum kualitas turun lebih jauh.' if score < 25 else 'Pantau kondisi produk dan percepat pengiriman.'}"
    )

    alert = AnomalyAlert(
        batch_id=batch.id,
        alert_type="LOW_FRESHNESS",
        severity=severity,
        message=message,
    )
    db.add(alert)
    logger.warning(f"LOW_FRESHNESS alert created for batch {batch.id} (score={score})")


@celery_app.task(name="workers.freshness_worker.update_all_freshness_scores")
def update_all_freshness_scores():
    """Celery task: update freshness scores for all active batches every 30 minutes."""
    asyncio.get_event_loop().run_until_complete(_update_all_freshness_scores())
