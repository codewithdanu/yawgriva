"""
Farmer Reports router — Feature 4: Weekly Farm Report.

Endpoints:
  GET /farmer/reports       — List weekly reports for current farmer (last 3 months)
  GET /farmer/reports/{id}  — Get specific report detail
"""

import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.weekly_report import FarmWeeklyReport

router = APIRouter(prefix="/farmer/reports", tags=["farmer-reports"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class WeeklyReportListItem(BaseModel):
    id: uuid.UUID
    week_start: date
    week_end: date
    summary: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class WeeklyReportDetail(BaseModel):
    id: uuid.UUID
    week_start: date
    week_end: date
    report_text: str
    summary: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[WeeklyReportListItem])
async def list_farmer_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List weekly reports for current farmer (last 3 months)."""
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Hanya petani yang dapat melihat laporan ini")

    three_months_ago = date.today() - timedelta(days=90)

    result = await db.execute(
        select(FarmWeeklyReport)
        .where(
            and_(
                FarmWeeklyReport.farmer_id == current_user.id,
                FarmWeeklyReport.week_end >= three_months_ago,
            )
        )
        .order_by(FarmWeeklyReport.week_end.desc())
    )
    reports = result.scalars().all()
    return reports


@router.get("/{report_id}", response_model=WeeklyReportDetail)
async def get_farmer_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific weekly report."""
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Hanya petani yang dapat melihat laporan ini")

    result = await db.execute(
        select(FarmWeeklyReport).where(FarmWeeklyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    if report.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    return report
