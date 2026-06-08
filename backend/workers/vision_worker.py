"""
Vision Worker — Feature 3.

Processes photo condition analysis asynchronously using Gemini Vision and updates distribution checkpoint.
"""

import asyncio
import logging
from sqlalchemy import select

from workers.celery_app import celery_app
from core.database import async_session_factory
from models.checkpoint import DistributionCheckpoint
from services.vision_service import analyze_product_photo
from services.storage_service import storage_service

logger = logging.getLogger(__name__)


async def _analyze_checkpoint_photo(checkpoint_id: str, storage_key: str, commodity: str):
    """Asynchronously download file from MinIO, analyze with Gemini Vision, and update checkpoint DB record."""
    logger.info(f"Starting async vision analysis for checkpoint {checkpoint_id} (key: {storage_key})")
    
    try:
        image_bytes = storage_service.get_file(storage_key)
    except Exception as e:
        logger.error(f"Failed to read image from MinIO for key {storage_key}: {e}")
        return

    # Call the vision analysis
    analysis_result = await analyze_product_photo(image_bytes, commodity)
    logger.info(f"Gemini analysis complete for checkpoint {checkpoint_id}. Condition: {analysis_result.condition}")

    async with async_session_factory() as db:
        # Retrieve checkpoint
        import uuid
        cp_uuid = uuid.UUID(checkpoint_id) if isinstance(checkpoint_id, str) else checkpoint_id
        result = await db.execute(
            select(DistributionCheckpoint).where(DistributionCheckpoint.id == cp_uuid)
        )
        cp = result.scalar_one_or_none()
        if not cp:
            logger.error(f"Checkpoint {checkpoint_id} not found in database.")
            return

        # Update checkpoint with analysis results
        cp.visual_condition = analysis_result.condition
        cp.visual_summary = analysis_result.summary
        cp.visual_issues = analysis_result.issues
        cp.visual_confidence = analysis_result.confidence
        
        await db.commit()
        logger.info(f"Updated checkpoint {checkpoint_id} in database with vision analysis result.")


@celery_app.task(name="workers.vision_worker.analyze_checkpoint_photo_task")
def analyze_checkpoint_photo_task(checkpoint_id: str, storage_key: str, commodity: str):
    """Celery task: Offload photo visual analysis to Gemini Vision and update DB."""
    logger.info(f"Celery: Received vision analysis task for checkpoint {checkpoint_id}")
    
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    loop.run_until_complete(_analyze_checkpoint_photo(checkpoint_id, storage_key, commodity))
    logger.info(f"✅ Celery vision analysis task complete for checkpoint {checkpoint_id}")
