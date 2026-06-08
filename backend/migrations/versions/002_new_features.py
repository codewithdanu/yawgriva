"""
Migration: Add new feature tables and columns.

Creates:
  - delivery_requests
  - distributor_performance
  - community_price_reports
  - community_price_aggregates
  - farm_weekly_reports

Alters:
  - product_batches: freshness_score, freshness_updated, total_distance_km,
                     total_co2_kg, co2_saved_kg, vehicle_type
  - distribution_checkpoints: photo_url, visual_condition, visual_summary,
                               visual_issues, visual_confidence
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid


# ─── Migration identifiers ───────────────────────────────────────────────────
revision = "002_new_features"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade():
    # ── Alter product_batches ─────────────────────────────────────────────
    op.add_column("product_batches", sa.Column("freshness_score", sa.Numeric(5, 2), nullable=True))
    op.add_column("product_batches", sa.Column("freshness_updated", sa.DateTime(timezone=True), nullable=True))
    op.add_column("product_batches", sa.Column("total_distance_km", sa.Numeric(8, 2), nullable=True))
    op.add_column("product_batches", sa.Column("total_co2_kg", sa.Numeric(8, 3), nullable=True))
    op.add_column("product_batches", sa.Column("co2_saved_kg", sa.Numeric(8, 3), nullable=True))
    op.add_column("product_batches", sa.Column("vehicle_type", sa.String(50), nullable=True))

    # ── Alter distribution_checkpoints ───────────────────────────────────
    op.add_column("distribution_checkpoints", sa.Column("photo_url", sa.Text(), nullable=True))
    op.add_column("distribution_checkpoints", sa.Column("visual_condition", sa.String(20), nullable=True))
    op.add_column("distribution_checkpoints", sa.Column("visual_summary", sa.Text(), nullable=True))
    op.add_column("distribution_checkpoints", sa.Column("visual_issues", JSONB, nullable=True))
    op.add_column("distribution_checkpoints", sa.Column("visual_confidence", sa.Numeric(4, 3), nullable=True))

    # ── Create delivery_requests ─────────────────────────────────────────
    op.create_table(
        "delivery_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("product_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("distributor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Create distributor_performance ───────────────────────────────────
    op.create_table(
        "distributor_performance",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("distributor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("avg_freshness_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("total_deliveries", sa.Integer, nullable=False, server_default="0"),
        sa.Column("on_time_deliveries", sa.Integer, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Create community_price_reports ───────────────────────────────────
    op.create_table(
        "community_price_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("reporter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("commodity_name", sa.String(100), nullable=False),
        sa.Column("price_per_kg", sa.Numeric(12, 2), nullable=False),
        sa.Column("market_name", sa.String(255), nullable=True),
        sa.Column("region", sa.String(100), nullable=False),
        sa.Column("transaction_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="validated"),
        sa.Column("reporter_weight", sa.Numeric(3, 2), nullable=False, server_default="1.0"),
        sa.Column("reported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_community_price_reports_commodity_region_date",
                    "community_price_reports",
                    ["commodity_name", "region", "reported_at"])

    # ── Create community_price_aggregates ────────────────────────────────
    op.create_table(
        "community_price_aggregates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("commodity_name", sa.String(100), nullable=False),
        sa.Column("region", sa.String(100), nullable=False),
        sa.Column("community_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("official_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("gap_percent", sa.Numeric(6, 2), nullable=True),
        sa.Column("report_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("alert_level", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("aggregated_for", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Create farm_weekly_reports ───────────────────────────────────────
    op.create_table(
        "farm_weekly_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("farmer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.Date, nullable=False),
        sa.Column("week_end", sa.Date, nullable=False),
        sa.Column("report_text", sa.Text, nullable=False),
        sa.Column("summary", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_farm_weekly_reports_farmer_week",
                    "farm_weekly_reports",
                    ["farmer_id", "week_end"])


def downgrade():
    # Drop new tables
    op.drop_table("farm_weekly_reports")
    op.drop_table("community_price_aggregates")
    op.drop_table("community_price_reports")
    op.drop_table("distributor_performance")
    op.drop_table("delivery_requests")

    # Drop new columns from product_batches
    for col in ["vehicle_type", "co2_saved_kg", "total_co2_kg", "total_distance_km", "freshness_updated", "freshness_score"]:
        op.drop_column("product_batches", col)

    # Drop new columns from distribution_checkpoints
    for col in ["visual_confidence", "visual_issues", "visual_summary", "visual_condition", "photo_url"]:
        op.drop_column("distribution_checkpoints", col)
