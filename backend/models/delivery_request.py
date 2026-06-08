"""
Delivery request model — matching system between farmers and distributors.
Feature 2: Farmer-Distributor Matching System.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Numeric, ForeignKey, CheckConstraint, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DeliveryRequest(Base):
    """
    A matching request sent from farmer (via system) to a specific distributor.
    Expires after 2 hours if not responded to.
    """
    __tablename__ = "delivery_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'expired')",
            name="ck_delivery_request_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_batches.id"), nullable=False
    )
    distributor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    match_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    batch = relationship("ProductBatch", back_populates="delivery_requests")
    distributor = relationship("User", foreign_keys=[distributor_id])


class DistributorPerformance(Base):
    """
    Aggregated performance metrics per distributor. Updated after each batch delivery.
    Used by matching algorithm to score distributors.
    """
    __tablename__ = "distributor_performance"

    distributor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    avg_freshness_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    on_time_rate: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)  # 0.000–1.000
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship
    distributor = relationship("User", foreign_keys=[distributor_id])
