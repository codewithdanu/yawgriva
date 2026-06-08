import {
  Sprout,
  MapPin,
  Clock,
  Thermometer,
  CheckCircle2,
  Truck,
  ShoppingBag,
  Leaf,
  Activity,
  Wind,
  Camera,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { formatCommodityName } from "../../../lib/utils";

/**
 * Public traceability page — Server Component (RSC)
 * Consumers scan QR → see full product journey
 * Target: renders in < 2 seconds with no loading flash
 */

async function getTraceData(qr: string) {
  try {
    return await api.trace.get(qr);
  } catch (error) {
    console.error("Error fetching trace data from API:", error);
    return null;
  }
}

export default async function TracePage({
  params,
}: {
  params: Promise<{ qr: string }>;
}) {
  const { qr } = await params;
  const data = await getTraceData(qr);

  if (!data) {
    return (
      <div className="trace-page">
        <div className="trace-container" style={{ maxWidth: "400px" }}>
          <div className="card" style={{ textAlign: "center", padding: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-4)", alignItems: "center" }}>
            <div style={{ width: "64px", height: "64px", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-full)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={32} />
            </div>
            <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Produk Tidak Ditemukan</h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              QR Code tidak terdaftar dalam sistem Yawgriva atau tautan pelacakan tidak valid.
            </p>
            <Link href="/" className="btn btn-primary" style={{ textDecoration: "none", width: "100%", textAlign: "center" }}>
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    registered: "Terdaftar",
    in_transit: "Dalam Pengiriman",
    delivered: "Terkirim",
    sold: "Terjual",
  };

  const statusColor: Record<string, string> = {
    registered: "badge-primary",
    in_transit: "badge-warning",
    delivered: "badge-success",
    sold: "badge-muted",
  };

  return (
    <div className="trace-page">
      <div className="trace-container">
        {/* Header */}
        <div className="trace-header">
          <Link href="/" className="trace-logo" style={{ display: "flex", alignItems: "center" }}>
            <img src="/images/logo-with-text.png" alt="Yawgriva Logo" style={{ height: "32px", objectFit: "contain" }} />
          </Link>
          <p className="trace-subtitle">Traceability — Asal-usul Produk Anda</p>
        </div>

        {/* Product Card */}
        <div className="trace-product card">
          <div className="product-header">
            <div className="product-icon">
              <Leaf size={24} />
            </div>
            <div>
              <h1 className="product-name">{formatCommodityName(data.batch.commodity_name)}</h1>
              <p className="product-meta">
                {data.batch.quantity_kg} kg · Panen {new Date(data.batch.harvest_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <span className={`badge ${statusColor[data.batch.status]}`}>
              {statusLabel[data.batch.status]}
            </span>
          </div>

          <div className="product-farmer">
            <Sprout size={16} color="var(--color-primary)" />
            <div>
              <span className="farmer-name">{data.farmer_name}</span>
              <span className="farmer-region">{data.farm_region}</span>
            </div>
          </div>

          {data.total_journey_hours && (
            <div className="journey-summary">
              <Clock size={14} />
              <span>Total perjalanan: <strong>{data.total_journey_hours} jam</strong></span>
            </div>
          )}

          {/* Freshness Score Badge */}
          {(data.batch as any).freshness_score && (
            <div className="freshness-row">
              <Activity size={14} />
              <span>Skor Kesegaran:</span>
              <div
                className="freshness-score-badge"
                style={{
                  background: (data.batch as any).freshness_score >= 80 ? "var(--color-success-bg)" :
                               (data.batch as any).freshness_score >= 60 ? "#FFF9E6" :
                               (data.batch as any).freshness_score >= 40 ? "#FEF3C7" : "var(--color-danger-bg)",
                  color: (data.batch as any).freshness_score >= 80 ? "var(--color-success)" :
                          (data.batch as any).freshness_score >= 60 ? "#B45309" :
                          (data.batch as any).freshness_score >= 40 ? "#D97706" : "var(--color-danger)",
                }}
              >
                {(data.batch as any).freshness_score.toFixed(0)}/100
              </div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {(data.batch as any).freshness_score >= 80 ? "Sangat Segar" :
                 (data.batch as any).freshness_score >= 60 ? "Segar" :
                 (data.batch as any).freshness_score >= 40 ? "Perlu Perhatian" : "Segera Distribusikan"}
              </span>
            </div>
          )}

          {/* Carbon Badge */}
          {(data.batch as any).total_co2_kg && (
            <div className="carbon-row">
              <Wind size={14} />
              <span>Jejak Karbon: <strong>{(data.batch as any).total_co2_kg} kg CO₂</strong></span>
              {(data.batch as any).co2_saved_kg && (
                <span className="carbon-saved">hemat {(data.batch as any).co2_saved_kg} kg</span>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="trace-timeline card">
          <h2 className="timeline-title">Jejak Distribusi</h2>
          <div className="timeline">
            {data.checkpoints.map((cp, i) => {
              const isFirst = i === 0;
              const isLast = i === data.checkpoints.length - 1;
              const Icon = isFirst ? Sprout : (isLast && data.batch.status === "delivered" ? ShoppingBag : Truck);
              const cpAny = cp as any;

              return (
                <div key={cp.id} className="timeline-item">
                  <div className="timeline-line-wrapper">
                    <div className={`timeline-dot ${isLast ? "timeline-dot-active" : ""}`}>
                      <Icon size={14} />
                    </div>
                    {!isLast && <div className="timeline-line" />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-location">
                      <MapPin size={14} />
                      <span>{cp.location_name}</span>
                    </div>
                    <div className="timeline-details">
                      <div className="timeline-detail">
                        <Clock size={12} />
                        <span>
                          {new Date(cp.scanned_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}{" "}
                          {new Date(cp.scanned_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {cp.temp_celsius && (
                        <div className="timeline-detail">
                          <Thermometer size={12} />
                          <span>{cp.temp_celsius}°C</span>
                        </div>
                      )}
                      {/* Visual condition badge */}
                      {cpAny.visual_condition && cpAny.visual_condition !== "unknown" && (
                        <div className="timeline-detail">
                          <Activity size={12} />
                          <span style={{
                            padding: "1px 6px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "10px",
                            fontWeight: 600,
                            background: cpAny.visual_condition === "excellent" ? "var(--color-success-bg)" :
                                        cpAny.visual_condition === "good" ? "#EFF6FF" :
                                        cpAny.visual_condition === "fair" ? "#FEF3C7" : "var(--color-danger-bg)",
                            color: cpAny.visual_condition === "excellent" ? "var(--color-success)" :
                                   cpAny.visual_condition === "good" ? "#1D4ED8" :
                                   cpAny.visual_condition === "fair" ? "#B45309" : "var(--color-danger)",
                          }}>
                            {cpAny.visual_condition === "excellent" ? "Sangat Baik" :
                             cpAny.visual_condition === "good" ? "Baik" :
                             cpAny.visual_condition === "fair" ? "Cukup" : "Perlu Perhatian"}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Photo thumbnail */}
                    {cpAny.photo_url && (
                      <div className="cp-photo-wrapper">
                        <Camera size={12} />
                        <img
                          src={cpAny.photo_url}
                          alt={`Foto kondisi di ${cp.location_name}`}
                          className="cp-photo"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        {cpAny.visual_summary && (
                          <p className="cp-photo-caption">{cpAny.visual_summary}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verification Badge */}
        <div className="verification-badge">
          <CheckCircle2 size={18} color="var(--color-primary)" />
          <span>Terverifikasi oleh Yawgriva Supply Chain</span>
        </div>

        {/* Footer */}
        <div className="trace-footer">
          <p>Scan dilakukan pada {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          <Link href="/">Powered by Yawgriva</Link>
        </div>
      </div>

      <style>{`
        .trace-page {
          min-height: 100vh;
          background: var(--color-muted);
          padding: var(--space-4);
          display: flex;
          justify-content: center;
        }

        .trace-container {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding: var(--space-4) 0;
        }

        .trace-header {
          text-align: center;
          padding: var(--space-4) 0;
        }

        .trace-logo {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: 700;
          font-size: var(--text-lg);
          color: var(--color-primary);
          margin-bottom: var(--space-1);
        }

        .trace-subtitle {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        /* Product */
        .product-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .product-icon {
          width: 48px;
          height: 48px;
          background: var(--color-primary-bg);
          color: var(--color-primary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .product-name {
          font-size: var(--text-xl);
          margin-bottom: 2px;
        }

        .product-meta {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        .product-farmer {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--color-primary-bg);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-3);
        }

        .farmer-name {
          display: block;
          font-size: var(--text-sm);
          font-weight: 500;
        }

        .farmer-region {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .journey-summary {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        /* Timeline */
        .timeline-title {
          font-size: var(--text-lg);
          margin-bottom: var(--space-4);
        }

        .timeline {
          display: flex;
          flex-direction: column;
        }

        .timeline-item {
          display: flex;
          gap: var(--space-4);
        }

        .timeline-line-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 32px;
          flex-shrink: 0;
        }

        .timeline-dot {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background: var(--color-muted);
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid var(--color-border);
        }

        .timeline-dot-active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .timeline-line {
          width: 2px;
          flex: 1;
          min-height: 24px;
          background: var(--color-border);
        }

        .timeline-content {
          flex: 1;
          padding-bottom: var(--space-6);
        }

        .timeline-location {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          font-weight: 500;
          margin-bottom: var(--space-2);
        }

        .timeline-details {
          display: flex;
          gap: var(--space-4);
        }

        .timeline-detail {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        /* Freshness + Carbon */
        .freshness-row, .carbon-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          margin-top: var(--space-2);
        }

        .freshness-score-badge {
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: 700;
        }

        .carbon-saved {
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--color-success-bg);
          color: var(--color-success);
          font-size: var(--text-xs);
          font-weight: 600;
        }

        /* Checkpoint photo */
        .cp-photo-wrapper {
          margin-top: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .cp-photo {
          width: 100%;
          max-width: 280px;
          height: 160px;
          object-fit: cover;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }

        .cp-photo-caption {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          font-style: italic;
        }

        /* Verification */
        .verification-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-3);
          background: var(--color-primary-bg);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-primary);
        }

        .trace-footer {
          text-align: center;
          padding: var(--space-4) 0;
        }

        .trace-footer p {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-bottom: var(--space-1);
        }

        .trace-footer a {
          font-size: var(--text-xs);
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}
