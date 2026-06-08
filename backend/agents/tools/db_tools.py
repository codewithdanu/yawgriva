"""
Database query tools for AI agents.
Provides access to product batches, checkpoints, and user profile information.
"""

import uuid
from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from langchain_core.tools import tool

from core.database import async_session
from models.batch import ProductBatch, FarmerProfile
from models.checkpoint import DistributionCheckpoint
from models.user import User
from models.alert import AnomalyAlert


@tool
async def query_batch_status(qr_code_hash: str) -> Dict[str, Any]:
    """
    Mendapatkan status lengkap dari batch produk berdasarkan qr_code_hash.
    Mengembalikan data komoditas, jumlah, tanggal panen, status, dan riwayat checkpoint.
    """
    async with async_session() as session:
        # Get batch with checkpoints and alerts loaded
        query = (
            select(ProductBatch)
            .where(ProductBatch.qr_code_hash == qr_code_hash)
            .options(
                selectinload(ProductBatch.checkpoints).selectinload(DistributionCheckpoint.scanner),
                selectinload(ProductBatch.alerts)
            )
        )
        result = await session.execute(query)
        batch = result.scalar_one_or_none()
        
        if not batch:
            return {"error": f"Batch dengan QR hash '{qr_code_hash}' tidak ditemukan."}
            
        checkpoints_data = []
        for cp in sorted(batch.checkpoints, key=lambda x: x.scanned_at):
            checkpoints_data.append({
                "location_name": cp.location_name,
                "temp_celsius": float(cp.temp_celsius) if cp.temp_celsius is not None else None,
                "scanned_at": cp.scanned_at.isoformat(),
                "scanned_by": cp.scanner.name if cp.scanner else "System"
            })
            
        alerts_data = []
        for alert in batch.alerts:
            alerts_data.append({
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "created_at": alert.created_at.isoformat(),
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None
            })
            
        return {
            "batch_id": str(batch.id),
            "commodity_name": batch.commodity_name,
            "quantity_kg": float(batch.quantity_kg),
            "harvest_date": batch.harvest_date.isoformat(),
            "status": batch.status,
            "created_at": batch.created_at.isoformat(),
            "checkpoints": checkpoints_data,
            "alerts": alerts_data
        }


@tool
async def get_farmer_profile(username: str) -> Dict[str, Any]:
    """
    Mendapatkan detail profil petani berdasarkan nama atau email mereka.
    Mengembalikan nama kebun, alamat, luas lahan, komoditas yang ditanam, dan koordinat.
    """
    async with async_session() as session:
        query = (
            select(User)
            .where((User.name.ilike(f"%{username}%") | (User.email == username)), User.role == "farmer")
            .options(selectinload(User.farmer_profile))
        )
        result = await session.execute(query)
        user = result.scalars().first()
        
        if not user or not user.farmer_profile:
            return {"error": f"Profil petani dengan nama/email '{username}' tidak ditemukan."}
            
        profile = user.farmer_profile
        return {
            "name": user.name,
            "email": user.email,
            "farm_name": profile.farm_name,
            "farm_address": profile.farm_address,
            "latitude": float(profile.latitude) if profile.latitude is not None else None,
            "longitude": float(profile.longitude) if profile.longitude is not None else None,
            "land_area_ha": float(profile.land_area_ha) if profile.land_area_ha is not None else None,
            "commodities": profile.commodities
        }


@tool
async def get_active_batches(username: str) -> List[Dict[str, Any]]:
    """
    Mendapatkan semua batch produk aktif (status selain 'sold' dan 'delivered') 
    yang dimiliki oleh petani berdasarkan nama atau email mereka.
    """
    async with async_session() as session:
        user_query = select(User).where((User.name.ilike(f"%{username}%") | (User.email == username)), User.role == "farmer")
        user_result = await session.execute(user_query)
        user = user_result.scalars().first()
        
        if not user:
            return []
            
        query = (
            select(ProductBatch)
            .where(
                ProductBatch.farmer_id == user.id,
                ProductBatch.status.notin_(["sold", "delivered"])
            )
            .order_by(ProductBatch.created_at.desc())
        )
        result = await session.execute(query)
        batches = result.scalars().all()
        
        return [
            {
                "batch_id": str(b.id),
                "commodity_name": b.commodity_name,
                "quantity_kg": float(b.quantity_kg),
                "harvest_date": b.harvest_date.isoformat(),
                "qr_code_hash": b.qr_code_hash,
                "status": b.status,
                "created_at": b.created_at.isoformat()
            }
            for b in batches
        ]


@tool
async def raise_anomaly_alert(batch_id: str, alert_type: str, severity: str, message: str) -> Dict[str, Any]:
    """
    Membuat alert anomali baru di database untuk batch produk tertentu.
    Mengembalikan konfirmasi apakah pembuatan alert berhasil.
    Parameter:
      - batch_id: ID batch dalam format UUID string.
      - alert_type: tipe anomali (misal: 'suhu_tinggi', 'rute_menyimpang', 'panen_tertunda').
      - severity: tingkat keparahan ('low', 'medium', 'high').
      - message: pesan deskripsi anomali yang ditemukan.
    """
    async with async_session() as session:
        try:
            b_uuid = uuid.UUID(batch_id)
            
            # Verify batch exists
            query = select(ProductBatch).where(ProductBatch.id == b_uuid)
            res = await session.execute(query)
            batch = res.scalar_one_or_none()
            if not batch:
                return {"error": f"Batch dengan ID '{batch_id}' tidak ditemukan."}
                
            alert = AnomalyAlert(
                batch_id=b_uuid,
                alert_type=alert_type,
                severity=severity,
                message=message
            )
            session.add(alert)
            await session.commit()
            return {"status": "success", "alert_id": str(alert.id), "message": "Alert anomali berhasil dibuat."}
        except Exception as e:
            await session.rollback()
            return {"error": f"Gagal membuat alert anomali: {str(e)}"}

