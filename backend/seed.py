"""
Seed script — populate database with mock data for development/demo.
Run with: python seed.py
"""

import asyncio
import sys
sys.path.insert(0, ".")

from core.database import async_session, engine, Base
from core.security import hash_password
from models.user import User
from models.batch import ProductBatch, FarmerProfile
from models.checkpoint import DistributionCheckpoint
from models.price import CommodityPrice, PricePrediction
from models.alert import AgentLog, AnomalyAlert
from models.delivery_request import DeliveryRequest
from services.price_service import PriceService
from services.qr_service import QRService

import uuid
from datetime import datetime, date, timezone, timedelta


async def seed():
    """Seed the database with demo data."""
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        print("🌱 Seeding users...")

        # Admin user
        admin = User(
            name="Admin Yawgriva",
            email="admin@mail.com",
            phone="081200000001",
            role="admin",
            hashed_pw=hash_password("admin123"),
            region="DKI Jakarta",
        )
        db.add(admin)

        # Farmer users
        farmers = []
        farmer_data = [
            ("Pak Budi Santoso", "budi@mail.com", "081311111001", "Jawa Barat"),
            ("Ibu Sari Dewi", "sari@mail.com", "081311111002", "Jawa Tengah"),
            ("Pak Made Wirawan", "made@mail.com", "081311111003", "Bali"),
        ]
        for name, email, phone, region in farmer_data:
            farmer = User(
                name=name,
                email=email,
                phone=phone,
                role="farmer",
                hashed_pw=hash_password("farmer123"),
                region=region,
            )
            db.add(farmer)
            farmers.append(farmer)

        # Distributor
        distributor = User(
            name="PT Distribusi Segar",
            email="distributor@mail.com",
            phone="081422222001",
            role="distributor",
            hashed_pw=hash_password("distrib123"),
            region="Jawa Barat",
        )
        db.add(distributor)


        await db.flush()

        # Farmer profiles
        print("🌾 Seeding farmer profiles...")
        profiles = [
            FarmerProfile(
                user_id=farmers[0].id,
                farm_name="Kebun Budi Makmur",
                farm_address="Desa Cipanas, Cianjur, Jawa Barat",
                latitude=-6.7316,
                longitude=107.0431,
                land_area_ha=2.5,
                commodities=["cabai_merah", "tomat", "kangkung"],
            ),
            FarmerProfile(
                user_id=farmers[1].id,
                farm_name="Tani Sari Organik",
                farm_address="Desa Kopeng, Semarang, Jawa Tengah",
                latitude=-7.3652,
                longitude=110.4489,
                land_area_ha=1.8,
                commodities=["bawang_merah", "wortel", "kentang"],
            ),
            FarmerProfile(
                user_id=farmers[2].id,
                farm_name="Subak Tirta Wijaya",
                farm_address="Desa Kintamani, Bangli, Bali",
                latitude=-8.2843,
                longitude=115.3713,
                land_area_ha=3.2,
                commodities=["jeruk", "cabai_rawit", "tomat"],
            ),
            FarmerProfile(
                user_id=distributor.id,
                farm_name="Gudang PT Distribusi Segar",
                farm_address="Cianjur Town, Cianjur, Jawa Barat",
                latitude=-6.8208,
                longitude=107.1378,
                land_area_ha=0.0,
                commodities=[],
            ),
        ]
        for p in profiles:
            db.add(p)

        # Product batches
        print("📦 Seeding product batches...")
        batches = []
        batch_data = [
            (farmers[0].id, "cabai_merah", 150.0, date(2026, 5, 28), "registered"),
            (farmers[0].id, "tomat", 200.0, date(2026, 5, 30), "in_transit"),
            (farmers[1].id, "bawang_merah", 300.0, date(2026, 5, 25), "delivered"),
            (farmers[1].id, "wortel", 100.0, date(2026, 6, 1), "registered"),
            (farmers[2].id, "jeruk", 250.0, date(2026, 5, 27), "in_transit"),
        ]
        for farmer_id, commodity, qty, h_date, status in batch_data:
            has_carbon = status in ("in_transit", "delivered")
            batch = ProductBatch(
                farmer_id=farmer_id,
                commodity_name=commodity,
                quantity_kg=qty,
                harvest_date=h_date,
                qr_code_hash=QRService.generate_hash(),
                status=status,
                total_distance_km=75.5 if has_carbon else None,
                total_co2_kg=12.500 if has_carbon else None,
                co2_saved_kg=3.200 if has_carbon else None,
                vehicle_type="mobil_boks" if has_carbon else None,
            )
            db.add(batch)
            batches.append(batch)

        await db.flush()

        # Seed DeliveryRequest for in_transit/delivered batches to link to distributor
        print("🚚 Seeding accepted delivery requests...")
        for batch in batches:
            if batch.status in ("in_transit", "delivered"):
                req = DeliveryRequest(
                    batch_id=batch.id,
                    distributor_id=distributor.id,
                    status="accepted",
                    match_score=85.0,
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
                )
                db.add(req)

        # Checkpoints for in_transit/delivered batches
        print("📍 Seeding checkpoints...")
        now = datetime.now(timezone.utc)
        for batch in batches:
            if batch.status in ("in_transit", "delivered"):
                checkpoints = [
                    DistributionCheckpoint(
                        batch_id=batch.id,
                        scanned_by=distributor.id,
                        location_name="Gudang Pengumpulan Cianjur",
                        latitude=-6.7316,
                        longitude=107.0431,
                        temp_celsius=28.5,
                        scanned_at=now - timedelta(hours=12),
                    ),
                    DistributionCheckpoint(
                        batch_id=batch.id,
                        scanned_by=distributor.id,
                        location_name="Pasar Induk Kramat Jati",
                        latitude=-6.2779,
                        longitude=106.8685,
                        temp_celsius=26.0,
                        scanned_at=now - timedelta(hours=6),
                    ),
                ]
                for cp in checkpoints:
                    db.add(cp)

        # Seed commodity prices
        print("💰 Seeding price data...")
        price_count = await PriceService.seed_development_data(db)
        print(f"   → {price_count} price records created")

        # Seed some anomaly alerts
        print("⚠️  Seeding anomaly alerts...")
        alert = AnomalyAlert(
            batch_id=batches[1].id,  # tomat batch in_transit
            alert_type="temperature_spike",
            severity="medium",
            message="Suhu batch tomat naik ke 35°C di checkpoint terakhir. Risiko penurunan kualitas.",
        )
        db.add(alert)

        await db.commit()
        print("\n✅ Seeding complete!")
        print(f"   Users: 5 (1 admin, 3 farmer, 1 distributor)")
        print(f"   Batches: {len(batches)}")
        print(f"   Prices: {price_count}")
        print(f"\n📧 Login credentials:")
        print(f"   Admin:       admin@mail.com / admin123")
        print(f"   Farmer:      budi@mail.com / farmer123")
        print(f"   Distributor: distributor@mail.com / distrib123")


if __name__ == "__main__":
    asyncio.run(seed())
