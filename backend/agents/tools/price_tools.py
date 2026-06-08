"""
Price data query tools for the Price Intelligence Agent.
Reads price history and AI predictions from the database.
"""

from typing import Dict, Any, List
from datetime import datetime, date
from sqlalchemy import select
from langchain_core.tools import tool

from core.database import async_session
from models.price import CommodityPrice, PricePrediction


@tool
async def fetch_latest_prices(commodity_name: str, market_name: str = None) -> List[Dict[str, Any]]:
    """
    Mengambil data harga komoditas terbaru dari Panel Harga Kementan dan Info Pangan Jakarta.
    Dapat difilter berdasarkan nama pasar spesifik (misal: 'Pasar Induk Kramat Jati').
    """
    async with async_session() as session:
        # Standardize commodity name lookup to lowercase and underscore
        norm_commodity = commodity_name.lower().strip().replace(" ", "_")
        
        query = (
            select(CommodityPrice)
            .where(CommodityPrice.commodity_name == norm_commodity)
            .order_by(CommodityPrice.recorded_at.desc())
            .limit(20)
        )
        if market_name:
            query = query.where(CommodityPrice.market_name == market_name)
            
        result = await session.execute(query)
        prices = result.scalars().all()
        
        return [
            {
                "commodity_name": p.commodity_name,
                "market_name": p.market_name,
                "price_per_kg": float(p.price_per_kg),
                "recorded_at": p.recorded_at.isoformat(),
                "source": p.source
            }
            for p in prices
        ]


@tool
async def fetch_price_predictions(commodity_name: str, region: str = "Jawa") -> List[Dict[str, Any]]:
    """
    Mengambil prediksi harga di masa depan untuk komoditas tertentu di wilayah tertentu (default: 'Jawa').
    Mengembalikan harga prediksi dan tingkat kepercayaan (confidence score) untuk beberapa hari ke depan.
    """
    async with async_session() as session:
        norm_commodity = commodity_name.lower().strip().replace(" ", "_")
        
        query = (
            select(PricePrediction)
            .where(
                PricePrediction.commodity_name == norm_commodity,
                PricePrediction.region == region,
                PricePrediction.predicted_for >= date.today()
            )
            .order_by(PricePrediction.predicted_for.asc())
            .limit(14)
        )
        result = await session.execute(query)
        predictions = result.scalars().all()
        
        return [
            {
                "commodity_name": pred.commodity_name,
                "region": pred.region,
                "predicted_price": float(pred.predicted_price),
                "confidence": float(pred.confidence),
                "predicted_for": pred.predicted_for.isoformat(),
                "generated_at": pred.generated_at.isoformat()
            }
            for pred in predictions
        ]
