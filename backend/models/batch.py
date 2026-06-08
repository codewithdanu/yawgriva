"""
Product batch model — the smallest trackable unit in the supply chain.
Each batch has a unique QR code hash (uuid4-based, non-sequential).
"""

import uuid
from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy import String, Date, DateTime, Numeric, ForeignKey, CheckConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ProductBatch(Base):
    __tablename__ = "product_batches"
    __table_args__ = (
        CheckConstraint(
            "status IN ('registered', 'in_transit', 'delivered', 'sold')",
            name="ck_batch_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    commodity_name: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    harvest_date: Mapped[date] = mapped_column(Date, nullable=False)
    qr_code_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="registered")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Freshness Score (Feature 1)
    freshness_score: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    freshness_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Carbon Footprint (Feature 6)
    total_distance_km: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    total_co2_kg: Mapped[Optional[float]] = mapped_column(Numeric(8, 3), nullable=True)
    co2_saved_kg: Mapped[Optional[float]] = mapped_column(Numeric(8, 3), nullable=True)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Relationships
    farmer = relationship("User", back_populates="batches")
    checkpoints = relationship("DistributionCheckpoint", back_populates="batch")
    alerts = relationship("AnomalyAlert", back_populates="batch")
    delivery_requests = relationship("DeliveryRequest", back_populates="batch")

    @property
    def distributor_name(self) -> Optional[str]:
        if "delivery_requests" not in self.__dict__:
            return None
        for req in self.delivery_requests:
            if req.status == "accepted":
                if "distributor" in req.__dict__ and req.distributor:
                    return req.distributor.name
        return None

    @property
    def match_score(self) -> Optional[float]:
        if "delivery_requests" not in self.__dict__:
            return None
        for req in self.delivery_requests:
            if req.status == "accepted":
                return float(req.match_score) if req.match_score else None
        return None



class FarmerProfile(Base):
    """Extended profile for users with role='farmer'."""
    __tablename__ = "farmer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    farm_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    farm_address: Mapped[str | None] = mapped_column(nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    land_area_ha: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    commodities: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationship
    user = relationship("User", back_populates="farmer_profile")
