"""
Price worker — Celery task to scrape public prices and run Price Agent predictions.
"""

import logging
import asyncio
from datetime import datetime, timezone, timedelta
import random

from sqlalchemy.ext.asyncio import AsyncSession
from workers.celery_app import celery_app
from core.database import async_session
from models.price import CommodityPrice, PricePrediction
from services.scraper_service import PriceScraperService

logger = logging.getLogger(__name__)

async def _async_scrape_and_predict():
    """Async helper to fetch and save prices, then generate predictions."""
    logger.info("💰 [Async] Running price scraper and updates...")
    scraper = PriceScraperService()
    
    try:
        kementan_prices = await scraper.fetch_kementan_prices()
        jakarta_prices = await scraper.fetch_jakarta_prices()
        all_records = kementan_prices + jakarta_prices
        
        async with async_session() as session:
            # 1. Save new prices
            saved_count = 0
            for record in all_records:
                price_entry = CommodityPrice(
                    commodity_name=record["commodity_name"],
                    market_name=record["market_name"],
                    price_per_kg=record["price_per_kg"],
                    recorded_at=record["recorded_at"],
                    source=record["source"]
                )
                session.add(price_entry)
                saved_count += 1
            
            # 2. Generate updated predictions (simulating Price Intelligence Agent ML output)
            predictions_count = 0
            now = datetime.now(timezone.utc)
            
            from services.price_service import REGION_MARKETS_MAP

            # We update predictions for our primary commodities
            commodities = ["cabai_merah", "cabai_rawit", "tomat", "bawang_merah", "kangkung"]
            for region in REGION_MARKETS_MAP.keys():
                for commodity in commodities:
                    # Get the base config from the scraped prices to anchor predictions
                    # Filter relevant prices for this region if possible, otherwise use all
                    region_markets = REGION_MARKETS_MAP.get(region, [])
                    relevant_prices = [
                        r["price_per_kg"] 
                        for r in all_records 
                        if r["commodity_name"] == commodity and r["market_name"] in region_markets
                    ]
                    if not relevant_prices:
                        relevant_prices = [r["price_per_kg"] for r in all_records if r["commodity_name"] == commodity]
                    base_price = sum(relevant_prices) / len(relevant_prices) if relevant_prices else 20000
                    
                    # Predict for next 14 days
                    for day_offset in range(1, 15):
                        predicted_date = now.date() + timedelta(days=day_offset)
                        # Simulated trend with slight daily variation
                        trend = random.choice([-1, 0, 1])
                        predicted_price = round(base_price * (1 + trend * 0.03 * day_offset / 14), -2)
                        
                        prediction = PricePrediction(
                            commodity_name=commodity,
                            region=region,
                            predicted_price=predicted_price,
                            confidence=round(random.uniform(0.70, 0.95), 3),
                            predicted_for=predicted_date,
                        )
                        session.add(prediction)
                        predictions_count += 1
            
            await session.commit()
            logger.info(f"💰 Saved {saved_count} price records and created {predictions_count} predictions.")
            return {"prices_saved": saved_count, "predictions_created": predictions_count}
            
    except Exception as e:
        logger.error(f"Error in price scraping task: {e}")
        return {"error": str(e)}
    finally:
        await scraper.close()

@celery_app.task(name="workers.price_worker.run_daily_price_scraping")
def run_daily_price_scraping():
    """
    Periodic task to scrap prices and update predictions.
    """
    logger.info("💰 Celery: Starting daily price scraping task...")
    
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    result = loop.run_until_complete(_async_scrape_and_predict())
    return result
