"""
Community price models — crowdsourced price reporting by farmers.
Feature 5: Community Price Report.
"""

import uuid
from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Numeric, ForeignKey, CheckConstraint, Integer, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class CommunityPriceReport(Base):
    """
    A price report submitted by a farmer for a specific commodity, market, and region.
    Three-layer validation: rate limiting (Redis), outlier detection, and reporter weight.
    """
    __tablename__ = "community_price_reports"
    __table_args__ = (
        CheckConstraint(
            "status IN ('validated', 'suspect', 'rejected')",
            name="ck_community_price_status",
        ),
        CheckConstraint(
            "transaction_type IN ('tengkulak', 'pasar', 'langsung')",
            name="ck_community_price_tx_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    commodity_name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_per_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    market_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="validated")
    reporter_weight: Mapped[float] = mapped_column(Numeric(3, 2), default=1.0)
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship
    reporter = relationship("User", foreign_keys=[reporter_id])


class CommunityPriceAggregate(Base):
    """
    Daily aggregated community price per commodity per region.
    Computed from validated CommunityPriceReport entries using weighted median.
    """
    __tablename__ = "community_price_aggregates"
    __table_args__ = (
        CheckConstraint(
            "alert_level IN ('normal', 'medium', 'high')",
            name="ck_community_price_alert",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    commodity_name: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    community_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    official_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    gap_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    alert_level: Mapped[str] = mapped_column(String(10), default="normal")
    aggregated_for: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
