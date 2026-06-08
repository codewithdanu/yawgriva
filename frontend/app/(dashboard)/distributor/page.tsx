"use client";

import { useState, useEffect } from "react";
import {
  Package,
  MapPin,
  Truck,
  Clock,
  Leaf,
  ArrowRight,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function DistributorDashboard() {
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [checkpointCount, setCheckpointCount] = useState(0);
  const [co2SavedCount, setCo2SavedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDistributorData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      // 1. Fetch batches
      const allBatches = await api.batches.list(token);
      
      // Available batches are those registered by farmers but not yet picked up
      const registered = allBatches.filter((b: any) => b.status === "registered");
      setAvailableBatches(registered);

      // Active routes are batches currently in transit
      const inTransit = allBatches.filter((b: any) => b.status === "in_transit");
      
      // Calculate a estimated route mapping
      const mappedRoutes = inTransit.map((b: any) => {
        // Find latest checkpoint or default
        const latestCp = b.checkpoints && b.checkpoints.length > 0
          ? b.checkpoints[b.checkpoints.length - 1]
          : null;
          
        return {
          id: b.id,
          batch: `${b.commodity_name.replace(/_/g, " ").toUpperCase()} — ${b.quantity_kg}kg`,
          route: latestCp ? `${latestCp.location_name} → Pasar Induk` : "Kebun Asal → Pasar Induk",
          eta: "2 jam 15 menit", // Mock eta value for UI
          freshness: 0.88, // Calculated default
        };
      });
      setActiveRoutes(mappedRoutes);

      // Count checkpoints scanner today and carbon savings
      let totalCheckpoints = 0;
      let totalCo2Saved = 0;
      allBatches.forEach((b: any) => {
        if (b.checkpoints) {
          totalCheckpoints += b.checkpoints.length;
        }
        if (b.co2_saved_kg) {
          totalCo2Saved += b.co2_saved_kg;
        }
      });
      setCheckpointCount(totalCheckpoints);
      setCo2SavedCount(totalCo2Saved);
    } catch (err) {
      console.error("Error loading distributor dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributorData();
  }, []);

  return (
    <div className="distributor-dashboard">
      {/* Header */}
      <div className="animate-fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-1)" }}>
            Dashboard Distributor
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Batch tersedia dan rute aktif hari ini
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDistributorData} disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="stats-row animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="card stat-card">
          <Package size={20} color="var(--color-primary)" />
          <div>
            <p className="stat-value">{loading ? "..." : availableBatches.length}</p>
            <p className="stat-label">Batch Tersedia</p>
          </div>
        </div>
        <div className="card stat-card">
          <Truck size={20} color="var(--color-warning)" />
          <div>
            <p className="stat-value">{loading ? "..." : activeRoutes.length}</p>
            <p className="stat-label">Rute Aktif</p>
          </div>
        </div>
        <div className="card stat-card">
          <ScanLine size={20} color="var(--color-primary-mid)" />
          <div>
            <p className="stat-value">{loading ? "..." : checkpointCount}</p>
            <p className="stat-label">Checkpoint Scan</p>
          </div>
        </div>
        <div className="card stat-card">
          <Leaf size={20} color="var(--color-success)" />
          <div>
            <p className="stat-value">{loading ? "..." : `${co2SavedCount.toFixed(1)} kg`}</p>
            <p className="stat-label">Emisi CO₂ Dihemat</p>
          </div>
        </div>
      </div>

      <div className="section-grid">
        {/* Available Batches */}
        <div className="card animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="card-header">
            <h2 style={{ fontSize: "var(--text-lg)" }}>Batch Siap Kirim</h2>
            <span className="badge badge-primary">{availableBatches.length} batch</span>
          </div>
          
          {loading ? (
            <div className="skeleton" style={{ height: "150px" }} />
          ) : availableBatches.length === 0 ? (
            <div className="empty-state flex-center">
              <Package size={32} color="var(--color-border)" style={{ marginBottom: "8px" }} />
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                Tidak ada batch yang siap dikirim saat ini
              </p>
            </div>
          ) : (
            <div className="batch-table">
              {availableBatches.map((batch) => (
                <div key={batch.id} className="batch-row">
                  <div className="batch-main">
                    <div className="batch-commodity-icon">
                      <Leaf size={16} />
                    </div>
                    <div>
                      <span className="batch-name">{batch.commodity_name.replace(/_/g, " ").toUpperCase()}</span>
                      <span className="batch-detail">{batch.quantity_kg} kg · ID: {batch.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <div className="batch-meta-col">
                    <MapPin size={12} />
                    <span>Jawa Barat</span>
                  </div>
                  <div className="batch-meta-col" style={{ marginLeft: "auto" }}>
                    <span className="batch-price">{formatCurrency(batch.commodity_name === "cabai_merah" ? 45000 : 12000)}/kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Routes */}
        <div className="card animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="card-header">
            <h2 style={{ fontSize: "var(--text-lg)" }}>Rute Aktif</h2>
            <Link href="/distributor/route-planner" className="btn btn-primary btn-sm">
              <Truck size={14} />
              Rencana Rute AI
            </Link>
          </div>
          
          {loading ? (
            <div className="skeleton" style={{ height: "150px" }} />
          ) : activeRoutes.length === 0 ? (
            <div className="empty-state flex-center">
              <Truck size={32} color="var(--color-border)" style={{ marginBottom: "8px" }} />
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                Belum ada rute pengiriman yang aktif
              </p>
            </div>
          ) : (
            <div className="route-list">
              {activeRoutes.map((route) => (
                <div key={route.id} className="route-card">
                  <div className="route-header">
                    <Truck size={18} color="var(--color-primary)" />
                    <span className="route-batch">{route.batch}</span>
                  </div>
                  <div className="route-path">
                    <MapPin size={14} />
                    <span>{route.route}</span>
                  </div>
                  <div className="route-footer">
                    <div className="route-eta">
                      <Clock size={12} />
                      <span>ETA: {route.eta}</span>
                    </div>
                    <div className="freshness-bar" style={{ width: 80 }}>
                      <div className="freshness-fill" style={{ width: `${route.freshness * 100}%` }} />
                      <span className="freshness-label">{Math.round(route.freshness * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .distributor-dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .stat-value {
          font-size: var(--text-xl);
          font-weight: 700;
          line-height: 1.2;
        }

        .stat-label {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .section-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: var(--space-6);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }

        /* Batch table */
        .batch-table {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .batch-row {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-3);
          background: var(--color-muted);
          border-radius: var(--radius-md);
          flex-wrap: wrap;
        }

        .batch-main {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
          min-width: 160px;
        }

        .batch-commodity-icon {
          width: 32px;
          height: 32px;
          background: var(--color-primary-bg);
          color: var(--color-primary);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .batch-name {
          display: block;
          font-size: var(--text-sm);
          font-weight: 500;
        }

        .batch-detail {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .batch-meta-col {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .batch-price {
          font-weight: 600;
          color: var(--color-text);
        }

        .freshness-bar {
          width: 60px;
          height: 6px;
          background: var(--color-border);
          border-radius: var(--radius-full);
          position: relative;
          overflow: hidden;
        }

        .freshness-fill {
          height: 100%;
          background: var(--color-primary);
          border-radius: var(--radius-full);
          transition: width var(--transition-slow);
        }

        .freshness-label {
          position: absolute;
          top: -16px;
          right: 0;
          font-size: 10px;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        /* Routes */
        .route-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .route-card {
          padding: var(--space-4);
          background: var(--color-muted);
          border-radius: var(--radius-md);
        }

        .route-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .route-batch {
          font-size: var(--text-sm);
          font-weight: 500;
        }

        .route-path {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-bottom: var(--space-3);
        }

        .route-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .route-eta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .empty-state {
          flex-direction: column;
          padding: var(--space-8) 0;
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 1024px) {
          .section-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .stats-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
