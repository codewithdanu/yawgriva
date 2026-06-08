"""
Weekly Farm Report Worker — Feature 4.

Generates AI-written weekly reports for all active farmers.
Runs every Monday at 07:00 WIB via Celery beat.

One LLM call per farmer per week.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, timedelta, datetime, timezone
from typing import Optional

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

WEEKLY_REPORT_PROMPT = """
Tulis laporan mingguan untuk petani dalam Bahasa Indonesia yang santai dan langsung.
Maksimal 5 kalimat. Jangan gunakan angka desimal panjang. Bulatkan ke ratusan terdekat.
Jangan gunakan kata "laporan", "analisis", atau istilah formal lainnya.
Mulai langsung dengan hasil, bukan dengan "Hai" atau salam.

Struktur yang diharapkan:
1. Apa yang terjadi minggu ini (ringkas, 1 kalimat)
2. Apakah hasil jualnya bagus dibanding pasar (1 kalimat, jujur)
3. Satu tips konkret untuk minggu depan berdasarkan prediksi harga
4. Satu kalimat penutup yang memotivasi (bukan klise)

Data: {weekly_data_json}
"""


@dataclass
class WeeklyFarmData:
    farmer_name: str
    farmer_id: str
    week_start: date
    week_end: date
    batches_registered: int
    batches_delivered: int
    has_activity: bool
    commodities_summary: list  # [{commodity, qty_kg}]


async def _collect_weekly_data(farmer_id: str, week_start: date, week_end: date) -> WeeklyFarmData:
    """Collect farmer's activity for the given week from the database."""
    from core.database import async_session_factory
    from sqlalchemy import select, and_, func
    from models.batch import ProductBatch
    from models.user import User

    async with async_session_factory() as db:
        # Get farmer name
        user_result = await db.execute(select(User).where(User.id == farmer_id))
        farmer = user_result.scalar_one_or_none()
        farmer_name = farmer.name if farmer else "Petani"

        # Count batches in this week
        batches_result = await db.execute(
            select(ProductBatch).where(
                and_(
                    ProductBatch.farmer_id == farmer_id,
                    ProductBatch.created_at >= datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc),
                    ProductBatch.created_at < datetime.combine(week_end + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc),
                )
            )
        )
        batches = batches_result.scalars().all()

        batches_registered = len(batches)
        batches_delivered = sum(1 for b in batches if b.status in ("delivered", "sold"))

        commodities = {}
        for b in batches:
            key = b.commodity_name
            if key not in commodities:
                commodities[key] = 0
            commodities[key] += float(b.quantity_kg)

        commodities_summary = [
            {"commodity": k, "qty_kg": round(v, 1)}
            for k, v in commodities.items()
        ]

        return WeeklyFarmData(
            farmer_name=farmer_name,
            farmer_id=farmer_id,
            week_start=week_start,
            week_end=week_end,
            batches_registered=batches_registered,
            batches_delivered=batches_delivered,
            has_activity=batches_registered > 0,
            commodities_summary=commodities_summary,
        )


async def _generate_report_text(data: WeeklyFarmData) -> tuple[str, str]:
    """
    Generate report text using LLM.
    Returns (full_report_text, one_liner_summary).
    """
    import json

    weekly_data_json = json.dumps({
        "petani": data.farmer_name,
        "minggu": f"{data.week_start.isoformat()} – {data.week_end.isoformat()}",
        "batch_terdaftar": data.batches_registered,
        "batch_terkirim": data.batches_delivered,
        "komoditas": data.commodities_summary,
    }, ensure_ascii=False)

    prompt = WEEKLY_REPORT_PROMPT.format(weekly_data_json=weekly_data_json)

    try:
        import google.generativeai as genai
        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            generation_config={"max_output_tokens": 300, "temperature": 0.7},
        )
        response = model.generate_content(prompt)
        report_text = response.text.strip()

        # Extract first sentence as summary (for push notification)
        summary = report_text.split(".")[0].strip() + "."
        return report_text, summary[:255]

    except Exception as e:
        logger.error(f"LLM report generation failed for farmer {data.farmer_id}: {e}")
        # Deterministic fallback
        commodity_str = ", ".join([c["commodity"] for c in data.commodities_summary]) or "produk"
        fallback = (
            f"Minggu ini kamu mendaftarkan {data.batches_registered} batch {commodity_str}. "
            f"{data.batches_delivered} batch sudah terkirim. "
            f"Pantau terus harga pasar di dashboard untuk keputusan jual yang lebih baik minggu depan."
        )
        return fallback, fallback[:255]


async def _save_report(farmer_id: str, data: WeeklyFarmData, report_text: str, summary: str):
    """Save generated report to database."""
    from core.database import async_session_factory
    from models.weekly_report import FarmWeeklyReport

    async with async_session_factory() as db:
        report = FarmWeeklyReport(
            farmer_id=farmer_id,
            week_start=data.week_start,
            week_end=data.week_end,
            report_text=report_text,
            summary=summary,
        )
        db.add(report)
        await db.commit()
        logger.info(f"Weekly report saved for farmer {farmer_id}")


async def _generate_single_farmer_report(farmer_id: str):
    """Generate and save weekly report for one farmer."""
    today = date.today()
    # Week: Monday to Sunday
    week_start = today - timedelta(days=today.weekday() + 7)  # last Monday
    week_end = week_start + timedelta(days=6)

    data = await _collect_weekly_data(farmer_id, week_start, week_end)
    if not data.has_activity:
        logger.info(f"No activity for farmer {farmer_id} this week, skipping")
        return

    report_text, summary = await _generate_report_text(data)
    await _save_report(farmer_id, data, report_text, summary)


async def _generate_all_farm_reports():
    """Generate reports for all active farmers."""
    from core.database import async_session_factory
    from sqlalchemy import select
    from models.user import User

    async with async_session_factory() as db:
        result = await db.execute(
            select(User.id).where(User.role == "farmer")
        )
        farmer_ids = [str(r[0]) for r in result.all()]

    logger.info(f"Generating weekly reports for {len(farmer_ids)} farmers")
    for farmer_id in farmer_ids:
        try:
            await _generate_single_farmer_report(farmer_id)
        except Exception as e:
            logger.error(f"Failed to generate report for farmer {farmer_id}: {e}")


@celery_app.task(name="workers.report_worker.generate_all_farm_reports")
def generate_all_farm_reports():
    """Celery task: generate weekly reports for all active farmers."""
    asyncio.get_event_loop().run_until_complete(_generate_all_farm_reports())
