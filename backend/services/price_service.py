# ASSUMPTIONS:
# 1. Since `CommodityPrice` model does not have a `region` field, we query prices by filtering 
#    the `market_name` using a mapping from regions to known markets (e.g., region "Jawa" maps to markets 
#    in Jakarta, Bandung, Solo, and Surabaya).
# 2. If the region is not in our mapping, we fallback to querying all price records for the given commodity.
# 3. For WMA MAPE calculation, we run a rolling 7-day window to calculate in-sample predictions for days 7 to N-1
#    and compute Mean Absolute Percentage Error.
# 4. SimpleExpSmoothing in-sample fit values are retrieved from the fit object's `fittedvalues` property.

"""
Price service — fetch and cache commodity prices.
Sources: Panel Harga Kementan + Info Pangan Jakarta.
"""

import random
import os
from datetime import datetime, date, timezone, timedelta
from typing import List, Optional, Dict, Any

import pandas as pd
from sqlalchemy import select, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from statsmodels.tsa.holtwinters import SimpleExpSmoothing

from models.price import CommodityPrice, PricePrediction
from services.scraper_service import PriceScraperService


# Mock price data for common commodities (Rp/kg)
MOCK_PRICES = {
    "cabai_merah": {"base": 45000, "volatility": 0.15},
    "cabai_rawit": {"base": 55000, "volatility": 0.20},
    "tomat": {"base": 12000, "volatility": 0.10},
    "bawang_merah": {"base": 35000, "volatility": 0.12},
    "bawang_putih": {"base": 28000, "volatility": 0.08},
    "kangkung": {"base": 8000, "volatility": 0.05},
    "bayam": {"base": 10000, "volatility": 0.06},
    "wortel": {"base": 15000, "volatility": 0.07},
    "kentang": {"base": 14000, "volatility": 0.09},
    "jeruk": {"base": 18000, "volatility": 0.10},
}

MARKETS = [
    "Pasar Induk Kramat Jati",
    "Pasar Induk Caringin Bandung",
    "Pasar Gede Solo",
    "Pasar Legi Surabaya",
    "Pasar Badung Denpasar",
]

REGION_MARKETS_MAP = {
    "Jawa": [
        "Pasar Induk Kramat Jati",
        "Pasar Induk Caringin Bandung",
        "Pasar Gede Solo",
        "Pasar Legi Surabaya",
    ],
    "Bali": [
        "Pasar Badung Denpasar",
    ],
    "DKI Jakarta": [
        "Pasar Induk Kramat Jati",
    ],
    "Jawa Barat": [
        "Pasar Induk Caringin Bandung",
    ],
    "Jawa Tengah": [
        "Pasar Gede Solo",
    ],
    "Jawa Timur": [
        "Pasar Legi Surabaya",
    ],
}


class PriceService:
    """Service for commodity price data and predictions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_latest_prices(
        self, commodity: str, market: Optional[str] = None
    ) -> List[CommodityPrice]:
        """Get the latest cached prices for a commodity."""
        query = (
            select(CommodityPrice)
            .where(CommodityPrice.commodity_name == commodity)
            .order_by(CommodityPrice.recorded_at.desc())
            .limit(30)
        )
        if market:
            query = query.where(CommodityPrice.market_name == market)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_prediction(
        self, commodity: str, region: str
    ) -> Optional[PricePrediction]:
        """Get the latest prediction for a commodity in a region."""
        result = await self.db.execute(
            select(PricePrediction)
            .where(
                PricePrediction.commodity_name == commodity,
                PricePrediction.region == region,
            )
            .order_by(PricePrediction.generated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def refresh_prices(self) -> int:
        """
        Fetch latest prices and save them to the database.
        Performs an upsert, skipping duplicates based on commodity_name + market_name + date.
        Returns the number of new records successfully saved.
        """
        scraper = PriceScraperService()
        try:
            records = await scraper.fetch_prices()
            if not records:
                return 0

            # Extract unique dates from fetched records to query selectively
            unique_dates = {r["recorded_at"].date() for r in records}

            # Query existing records on these dates
            stmt = select(CommodityPrice).where(
                cast(CommodityPrice.recorded_at, Date).in_(unique_dates)
            )
            result = await self.db.execute(stmt)
            existing = result.scalars().all()

            # Create a set of (commodity_name, market_name, date) for quick lookup
            existing_keys = {
                (
                    e.commodity_name,
                    e.market_name,
                    e.recorded_at.date() if isinstance(e.recorded_at, datetime) else e.recorded_at
                )
                for e in existing
            }

            # Filter and insert non-duplicates
            to_insert = []
            for r in records:
                rec_date = r["recorded_at"].date() if isinstance(r["recorded_at"], datetime) else r["recorded_at"]
                key = (r["commodity_name"], r["market_name"], rec_date)

                if key not in existing_keys:
                    new_price = CommodityPrice(
                        commodity_name=r["commodity_name"],
                        market_name=r["market_name"],
                        price_per_kg=r["price_per_kg"],
                        recorded_at=r["recorded_at"],
                        source=r["source"]
                    )
                    self.db.add(new_price)
                    to_insert.append(new_price)
                    existing_keys.add(key)

            if to_insert:
                await self.db.commit()

            return len(to_insert)
        finally:
            await scraper.close()

    @staticmethod
    async def seed_development_data(db: AsyncSession) -> int:
        """Seed database with mock price data for development/demo."""
        env = os.getenv("ENV", "development")
        if env not in ("development", "test"):
            raise RuntimeError("Cannot run seeding outside development or test environment.")

        count = 0
        now = datetime.now(timezone.utc)

        for commodity, config in MOCK_PRICES.items():
            for market in MARKETS:
                for day_offset in range(30):
                    price_date = now - timedelta(days=day_offset)
                    variation = random.uniform(
                        -config["volatility"], config["volatility"]
                    )
                    price = round(config["base"] * (1 + variation), -2)  # Round to 100

                    price_entry = CommodityPrice(
                        commodity_name=commodity,
                        market_name=market,
                        price_per_kg=price,
                        recorded_at=price_date,
                        source="panel_harga_kementan"
                        if day_offset % 2 == 0
                        else "info_pangan_jakarta",
                    )
                    db.add(price_entry)
                    count += 1

        # Seed predictions
        for region in REGION_MARKETS_MAP.keys():
            for commodity, config in MOCK_PRICES.items():
                for day_offset in range(1, 15):
                    predicted_date = now.date() + timedelta(days=day_offset)
                    trend = random.choice([-1, 0, 1])
                    predicted_price = round(
                        config["base"] * (1 + trend * 0.05 * day_offset / 14), -2
                    )

                    prediction = PricePrediction(
                        commodity_name=commodity,
                        region=region,
                        predicted_price=predicted_price,
                        confidence=round(random.uniform(0.65, 0.92), 3),
                        predicted_for=predicted_date,
                    )
                    db.add(prediction)
                    count += 1

        await db.commit()
        return count

    async def generate_prediction(
        self, commodity: str, region: str, horizon_days: int = 7
    ) -> Optional[PricePrediction]:
        """
        Generate a statistical price prediction for a commodity in a region.
        Uses Simple Exponential Smoothing (SES) or Weighted Moving Average (WMA)
        depending on data volume.
        """
        markets = REGION_MARKETS_MAP.get(region)
        query = (
            select(CommodityPrice)
            .where(CommodityPrice.commodity_name == commodity)
            .order_by(CommodityPrice.recorded_at.asc())
        )
        if markets:
            query = query.where(CommodityPrice.market_name.in_(markets))

        result = await self.db.execute(query)
        prices = result.scalars().all()

        if not prices:
            return None

        # Group by date and calculate average price per day
        daily_prices = {}
        for p in prices:
            d = p.recorded_at.date() if isinstance(p.recorded_at, datetime) else p.recorded_at
            if d not in daily_prices:
                daily_prices[d] = []
            daily_prices[d].append(p.price_per_kg)

        sorted_dates = sorted(daily_prices.keys())
        history_prices = [sum(daily_prices[d]) / len(daily_prices[d]) for d in sorted_dates]
        N = len(history_prices)

        if N < 7:
            # Data < 7 days: Return None, no prediction possible
            return None

        predicted_price: float = 0.0
        mape: float = 0.0

        if N >= 30:
            # Data >= 30 days: Simple Exponential Smoothing (SES)
            series = pd.Series(history_prices)
            model = SimpleExpSmoothing(series)
            fit = model.fit(optimized=True)
            forecast = fit.forecast(horizon_days)
            predicted_price = float(forecast.iloc[-1])

            # Calculate MAPE of the in-sample fit
            actuals = series
            fitted = fit.fittedvalues
            mape = (abs(actuals - fitted) / actuals.replace(0, 1)).mean()
        else:
            # Data 7-29 days: Weighted Moving Average (WMA)
            weights = list(range(1, N + 1))
            weighted_sum = sum(p * w for p, w in zip(history_prices, weights))
            predicted_price = weighted_sum / sum(weights)

            # Calculate MAPE of rolling WMA in-sample fit
            errors = []
            for i in range(7, N):
                window = history_prices[i-7:i]
                wma_pred = sum(val * (idx + 1) for idx, val in enumerate(window)) / sum(range(1, 8))
                actual = history_prices[i]
                if actual > 0:
                    errors.append(abs(actual - wma_pred) / actual)
            mape = sum(errors) / len(errors) if errors else 0.0

        # Confidence mapping based on MAPE
        if mape < 0.05:
            confidence = 0.90
        elif mape <= 0.10:
            confidence = 0.75
        else:
            confidence = 0.60

        predicted_date = datetime.now(timezone.utc).date() + timedelta(days=horizon_days)
        prediction = PricePrediction(
            commodity_name=commodity,
            region=region,
            predicted_price=round(predicted_price, 2),
            confidence=confidence,
            predicted_for=predicted_date,
            generated_at=datetime.now(timezone.utc),
        )

        self.db.add(prediction)
        await self.db.commit()
        return prediction
