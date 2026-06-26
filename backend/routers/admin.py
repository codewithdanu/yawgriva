"""
Admin router — system overview, user management, and alert resolution.
All endpoints require admin role.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.user import User
from models.batch import ProductBatch
from models.alert import AnomalyAlert
from models.community_price import CommunityPriceReport
from schemas.auth import UserResponse
from schemas.agent import AlertResponse, AIModelSettingsRequest, AIModelSettingsResponse
from routers.community_prices import CommunityPriceReportResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
async def get_system_overview(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """System overview — user counts, batch counts, active alerts."""
    user_count = await db.execute(select(func.count(User.id)))
    batch_count = await db.execute(select(func.count(ProductBatch.id)))
    active_alerts = await db.execute(
        select(func.count(AnomalyAlert.id)).where(AnomalyAlert.resolved_at.is_(None))
    )

    return {
        "total_users": user_count.scalar(),
        "total_batches": batch_count.scalar(),
        "active_alerts": active_alerts.scalar(),
    }


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users."""
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    return result.scalars().all()


from sqlalchemy.orm import joinedload

@router.get("/alerts", response_model=List[AlertResponse])
async def list_alerts(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all anomaly alerts, unresolved first."""
    result = await db.execute(
        select(AnomalyAlert)
        .options(joinedload(AnomalyAlert.batch).joinedload(ProductBatch.farmer))
        .order_by(AnomalyAlert.resolved_at.is_(None).desc(), AnomalyAlert.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.post("/alerts/trigger-scan")
async def trigger_anomaly_scan(
    current_user: User = Depends(require_role("admin")),
):
    """Trigger an on-demand scan of all active (in_transit) batches for anomalies."""
    from workers.anomaly_worker import _async_scan_active_batches
    try:
        result = await _async_scan_active_batches()
        return {
            "status": "success",
            "message": "Scan anomali selesai dijalankan.",
            "scanned_count": result.get("scanned", 0),
            "alerts_created": result.get("alerts_created", 0)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menjalankan scan: {str(e)}"
        )


@router.patch("/alerts/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Mark an anomaly alert as resolved."""
    from datetime import datetime, timezone

    result = await db.execute(
        select(AnomalyAlert)
        .options(joinedload(AnomalyAlert.batch).joinedload(ProductBatch.farmer))
        .where(AnomalyAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert tidak ditemukan")

    if alert.resolved_at:
        raise HTTPException(status_code=400, detail="Alert sudah di-resolve")

    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return alert



@router.patch("/users/{user_id}/verify", response_model=UserResponse)
async def verify_user(
    user_id: uuid.UUID,
    verified: bool,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Verify or unverify a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    user.is_verified = verified
    await db.commit()
    return user


@router.get("/outliers", response_model=List[CommunityPriceReportResponse])
async def list_outlier_reports(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List suspect and rejected price reports for validation."""
    result = await db.execute(
        select(CommunityPriceReport)
        .where(CommunityPriceReport.status.in_(["suspect", "rejected"]))
        .order_by(CommunityPriceReport.reported_at.desc())
    )
    return result.scalars().all()


@router.patch("/outliers/{report_id}/validate", response_model=CommunityPriceReportResponse)
async def validate_outlier_report(
    report_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Validate a price report, setting its status to validated."""
    result = await db.execute(
        select(CommunityPriceReport).where(CommunityPriceReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan harga tidak ditemukan")
    report.status = "validated"
    await db.commit()
    return report


@router.patch("/outliers/{report_id}/reject", response_model=CommunityPriceReportResponse)
async def reject_outlier_report(
    report_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Reject a price report, setting its status to rejected."""
    result = await db.execute(
        select(CommunityPriceReport).where(CommunityPriceReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan harga tidak ditemukan")
    report.status = "rejected"
    await db.commit()
    return report


@router.get("/ai-model", response_model=AIModelSettingsResponse)
async def get_ai_model_setting(
    current_user: User = Depends(require_role("admin")),
):
    """Get the current main AI model setting."""
    from core.redis import redis_client
    try:
        model = await redis_client.get("config:main_ai_model")
        if model in ("gemini", "openai"):
            return AIModelSettingsResponse(main_model=model)
    except Exception:
        pass
    return AIModelSettingsResponse(main_model="gemini")


@router.post("/ai-model", response_model=AIModelSettingsResponse)
async def update_ai_model_setting(
    request_body: AIModelSettingsRequest,
    current_user: User = Depends(require_role("admin")),
):
    """Update the main AI model setting (gemini or openai)."""
    if request_body.main_model not in ("gemini", "openai"):
        raise HTTPException(
            status_code=400,
            detail="Main model must be either 'gemini' or 'openai'"
        )
    
    from core.redis import redis_client
    try:
        await redis_client.set("config:main_ai_model", request_body.main_model)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan ke Redis: {str(e)}"
        )
        
    return AIModelSettingsResponse(main_model=request_body.main_model)
