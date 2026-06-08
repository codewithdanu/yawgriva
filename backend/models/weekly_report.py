"""
Weekly farm report model — AI-generated reports for farmers.
Feature 4: Weekly Farm Report via Celery beat every Monday 07:00 WIB.
"""

import uuid
from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class FarmWeeklyReport(Base):
    """
    AI-generated weekly summary per farmer. Stored for up to 3 months of history.
    Generated via Celery task every Monday at 07:00 WIB.
    """
    __tablename__ = "farm_weekly_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    report_text: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # one-liner for push notification
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship
    farmer = relationship("User", foreign_keys=[farmer_id])
