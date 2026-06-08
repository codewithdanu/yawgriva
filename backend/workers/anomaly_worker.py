"""
Anomaly detection worker — runs every 30 minutes via Celery Beat.
Scans all active (in_transit) batches for anomalies.
"""

import logging
import asyncio
from sqlalchemy import select
from workers.celery_app import celery_app
from core.database import async_session
from models.batch import ProductBatch
from agents.anomaly_agent import AnomalyAgent

logger = logging.getLogger(__name__)


async def _async_scan_active_batches():
    """Async helper to execute the anomaly scan."""
    logger.info("[Async] Starting anomaly scan...")
    anomaly_agent = AnomalyAgent()
    
    async with async_session() as session:
        # Get all active in_transit batches
        query = select(ProductBatch).where(ProductBatch.status == "in_transit")
        result = await session.execute(query)
        batches = result.scalars().all()
        
        scanned_count = len(batches)
        
        # Get count of alerts before
        from sqlalchemy import func
        from models.alert import AnomalyAlert
        alerts_before = (await session.execute(select(func.count(AnomalyAlert.id)))).scalar() or 0
        
        for batch in batches:
            try:
                # Ask agent to check the batch
                prompt = (
                    f"Periksa status keamanan dan kesehatan untuk batch produk "
                    f"dengan QR code hash '{batch.qr_code_hash}'. Cek apakah ada "
                    f"suhu tinggi, keterlambatan pengiriman, atau penyimpangan rute. "
                    f"Jika ada anomali, segera buat alert di database."
                )
                reply, _, _ = await anomaly_agent.execute(prompt)
                logger.info(f"AnomalyAgent result for batch {batch.id}: {reply[:100]}...")
            except Exception as e:
                logger.error(f"Error scanning batch {batch.id}: {e}")
                
        # Get count of alerts after
        alerts_after = (await session.execute(select(func.count(AnomalyAlert.id)))).scalar() or 0
        alerts_created = alerts_after - alerts_before
        
        return {"scanned": scanned_count, "alerts_created": alerts_created}


@celery_app.task(name="workers.anomaly_worker.scan_all_active_batches")
def scan_all_active_batches():
    """
    Scan all in_transit batches for anomalies:
    - Temperature spikes above threshold
    - Unusually long transit times
    - Route deviations
    - Price anomalies at destination
    """
    logger.info("Celery: Starting anomaly scan for all active batches...")
    
    # Run async scan in sync Celery task
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    result = loop.run_until_complete(_async_scan_active_batches())
    logger.info(f"✅ Celery anomaly scan complete: {result}")
    return result

