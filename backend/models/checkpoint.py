"""
Distribution checkpoint — each QR scan at a checkpoint in the supply chain.
Records location, scanner, optional temperature, and photo + visual analysis.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DistributionCheckpoint(Base):
    __tablename__ = "distribution_checkpoints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_batches.id"), nullable=False
    )
    scanned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    temp_celsius: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Photo + Visual Analysis (Feature 3)
    photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visual_condition: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # excellent/good/fair/poor/unknown
    visual_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visual_issues: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # array of strings
    visual_confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)

    # Relationships
    batch = relationship("ProductBatch", back_populates="checkpoints")
    scanner = relationship("User")
