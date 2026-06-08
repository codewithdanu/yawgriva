"use client";

import { useState, useEffect } from "react";
import {
  Sprout,
  Plus,
  QrCode,
  Download,
  Calendar,
  Layers,
  ArrowLeft,
  X,
  AlertCircle,
  MapPin,
  Truck,
  Clock,
  Thermometer,
  Activity,
  Camera,
  Leaf,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatDate, formatCommodityName } from "@/lib/utils";

// Standard crops in Indonesian
const COMMODITY_OPTIONS = [
  { value: "cabai_merah", label: "Cabai Merah Keriting" },
  { value: "cabai_rawit", label: "Cabai Rawit Merah" },
  { value: "tomat", label: "Tomat" },
  { value: "bawang_merah", label: "Bawang Merah" },
  { value: "bawang_putih", label: "Bawang Putih" },
  { value: "kangkung", label: "Kangkung" },
  { value: "bayam", label: "Bayam" },
  { value: "wortel", label: "Wortel" },
  { value: "kentang", label: "Kentang" },
  { value: "jeruk", label: "Jeruk" },
];

export default function BatchesPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Registration form state
  const [showModal, setShowModal] = useState(false);
  const [commodity, setCommodity] = useState(COMMODITY_OPTIONS[0].value);
  const [quantity, setQuantity] = useState("");
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  
  // Active QR state
  const [activeQR, setActiveQR] = useState<any | null>(null);
  
  // Tracking modal state
  const [trackingBatch, setTrackingBatch] = useState<any | null>(null);

  const fetchBatches = async () => {
    try {
      const token = getToken();
      if (!token) return;
      
      const data = await api.batches.list(token);
      setBatches(data);
    } catch (err: any) {
      setError("Gagal memuat daftar batch.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("Jumlah kuantitas harus lebih dari 0.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      const token = getToken();
      if (!token) return;
      
      const newBatch = await api.batches.create(token, {
        commodity_name: commodity,
        quantity_kg: parseFloat(quantity),
        harvest_date: harvestDate,
      });
      
      // Reset & refresh list
      setQuantity("");
      setShowModal(false);
      await fetchBatches();
      
      // Open QR Code dialog for the newly created batch
      setActiveQR(newBatch);
    } catch (err: any) {
      setError(err.message || "Gagal mendaftarkan batch.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      registered: "Terdaftar",
      in_transit: "Dalam Pengiriman",
      delivered: "Terkirim",
      sold: "Terjual",
    };
    const classes: Record<string, string> = {
      registered: "badge-primary",
      in_transit: "badge-warning",
      delivered: "badge-success",
      sold: "badge-muted",
    };
    return <span className={`badge ${classes[status] || "badge-muted"}`}>{labels[status] || status}</span>;
  };

  // Helper to generate the public traceability URL
  const getTraceUrl = (hash: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/trace/${hash}`;
  };

  // Helper to get QR Server image link
  const getQrImageSrc = (hash: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getTraceUrl(hash))}`;
  };

  return (
    <div className="batches-page">
      {/* Header */}
      <div className="page-header animate-fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-xl)" }}>Manajemen Batch Produk</h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
              Daftarkan hasil panen baru dan unduh QR code pelacakan
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Panen Baru
        </button>
      </div>

      {error && (
        <div className="card text-danger" style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--color-danger-bg)", borderColor: "var(--color-danger)", padding: "var(--space-4)" }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Main List */}
      <div className="card animate-fade-in" style={{ animationDelay: "0.1s" }}>
        {loading ? (
          <div className="loading-state">
            <div className="skeleton" style={{ height: "60px", marginBottom: "12px" }} />
            <div className="skeleton" style={{ height: "60px", marginBottom: "12px" }} />
            <div className="skeleton" style={{ height: "60px" }} />
          </div>
        ) : batches.length === 0 ? (
          <div className="empty-state flex-center">
            <Sprout size={48} color="var(--color-primary-mid)" style={{ marginBottom: "var(--space-3)" }} />
            <h3>Belum Ada Batch Terdaftar</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", textAlign: "center", marginTop: "4px" }}>
              Tekan tombol "Panen Baru" di atas untuk mendaftarkan batch produk pertanian Anda yang pertama.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="batches-table">
              <thead>
                <tr>
                  <th>Komoditas</th>
                  <th>Jumlah (kg)</th>
                  <th>Tanggal Panen</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div className="commodity-avatar">
                          <Sprout size={16} />
                        </div>
                        <span style={{ fontWeight: 500 }}>
                          {COMMODITY_OPTIONS.find((c) => c.value === batch.commodity_name)?.label || formatCommodityName(batch.commodity_name)}
                        </span>
                      </div>
                    </td>
                    <td>{batch.quantity_kg} kg</td>
                    <td>{formatDate(batch.harvest_date)}</td>
                    <td>{getStatusBadge(batch.status)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}
                          onClick={() => setActiveQR(batch)}
                        >
                          <QrCode size={14} />
                          QR Code
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}
                          onClick={() => setTrackingBatch(batch)}
                        >
                          <MapPin size={14} />
                          Lacak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Batch Modal */}
      {showModal && (
        <div className="modal-overlay flex-center">
          <div className="modal-content card animate-fade-in">
            <div className="modal-header">
              <h3 style={{ fontSize: "var(--text-lg)" }}>Daftarkan Panen Baru</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleRegisterBatch} className="modal-form">
              <div className="form-group">
                <label className="label">Komoditas</label>
                <select
                  className="input"
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                >
                  {COMMODITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Jumlah (kg)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Contoh: 150"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.1"
                  step="any"
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Tanggal Panen</label>
                <input
                  type="date"
                  className="input"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Mendaftarkan..." : "Daftarkan Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Viewer Modal */}
      {activeQR && (
        <div className="modal-overlay flex-center">
          <div className="modal-content card qr-modal animate-fade-in" style={{ maxWidth: "380px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "var(--text-base)" }}>QR Code Pelacakan</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setActiveQR(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="qr-container">
              <div className="qr-card">
                <div className="qr-brand" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <img src="/images/logo-no-text.png" alt="Logo" style={{ height: "16px", objectFit: "contain" }} />
                  <span>Yawgriva Supply Chain</span>
                </div>
                
                <img
                  src={getQrImageSrc(activeQR.qr_code_hash)}
                  alt="QR Code Pelacakan"
                  className="qr-image"
                />

                <div className="qr-meta">
                  <div className="qr-title">
                    {COMMODITY_OPTIONS.find((c) => c.value === activeQR.commodity_name)?.label || formatCommodityName(activeQR.commodity_name)}
                  </div>
                  <div className="qr-detail">
                    {activeQR.quantity_kg} kg · Panen {new Date(activeQR.harvest_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="qr-hash">{activeQR.qr_code_hash}</div>
                </div>
              </div>

              <div className="qr-actions">
                <a
                  href={getQrImageSrc(activeQR.qr_code_hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  <Download size={16} />
                  Unduh QR Code
                </a>
                <a
                  href={getTraceUrl(activeQR.qr_code_hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  Uji Tautan Pelacakan
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {trackingBatch && (
        <div className="modal-overlay flex-center">
          <div className="modal-content card tracking-modal animate-fade-in" style={{ maxWidth: "550px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "var(--text-lg)" }}>Detail Perjalanan & Distribusi</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setTrackingBatch(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="tracking-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Product Info Summary */}
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-3)" }}>
                <div style={{ width: "40px", height: "40px", background: "var(--color-primary-bg)", color: "var(--color-primary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Leaf size={20} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, margin: 0 }}>
                    {COMMODITY_OPTIONS.find((c) => c.value === trackingBatch.commodity_name)?.label || formatCommodityName(trackingBatch.commodity_name)}
                  </h4>
                  <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", margin: "2px 0 0 0" }}>
                    Kuantitas: {trackingBatch.quantity_kg} kg · Panen: {formatDate(trackingBatch.harvest_date)}
                  </p>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  {getStatusBadge(trackingBatch.status)}
                </div>
              </div>

              {/* Distributor Info */}
              <div className="distributor-card" style={{ background: "var(--color-muted)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Informasi Pengiriman</span>
                  {trackingBatch.match_score && (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-primary)", background: "var(--color-primary-bg)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>
                      Match Score: {trackingBatch.match_score}%
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
                  <Truck size={18} color="var(--color-primary)" />
                  <div>
                    <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                      {trackingBatch.distributor_name || "Menunggu Distributor"}
                    </span>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--color-text-muted)" }}>
                      {trackingBatch.distributor_name ? "Mitra Distributor Resmi" : "Belum dicocokkan dengan mitra logistik"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Quality & Carbon footprint */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                {/* Freshness Card */}
                <div className="metric-card" style={{ border: "1px solid var(--color-border)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                    <Activity size={14} />
                    <span>Skor Kesegaran</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                    <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: trackingBatch.freshness_score >= 80 ? "var(--color-success)" : trackingBatch.freshness_score >= 50 ? "#D97706" : "var(--color-danger)" }}>
                      {trackingBatch.freshness_score !== null && trackingBatch.freshness_score !== undefined ? `${trackingBatch.freshness_score.toFixed(0)}/100` : "-"}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                      {trackingBatch.freshness_score >= 80 ? "Sangat Segar" : trackingBatch.freshness_score >= 50 ? "Cukup Segar" : trackingBatch.freshness_score ? "Kurang Segar" : "Belum dihitung"}
                    </span>
                  </div>
                </div>

                {/* Carbon Card */}
                <div className="metric-card" style={{ border: "1px solid var(--color-border)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                    <Layers size={14} />
                    <span>Emisi Karbon (CO₂)</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "2px" }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
                      {trackingBatch.total_co2_kg ? `${trackingBatch.total_co2_kg.toFixed(2)} kg CO₂` : "-"}
                    </span>
                    {trackingBatch.co2_saved_kg && (
                      <span style={{ fontSize: "10px", color: "var(--color-success)", fontWeight: 600 }}>
                        Hemat {trackingBatch.co2_saved_kg.toFixed(2)} kg
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Journey Timeline */}
              <div style={{ marginTop: "var(--space-2)" }}>
                <h5 style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>Rute & Checkpoint Distribusi</h5>
                
                {!trackingBatch.checkpoints || trackingBatch.checkpoints.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "var(--space-4)", color: "var(--color-text-muted)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)" }}>
                    Belum ada checkpoint perjalanan yang terekam. Penjemputan komoditas oleh distributor akan mencatat titik awal pelacakan.
                  </div>
                ) : (
                  <div className="timeline" style={{ display: "flex", flexDirection: "column" }}>
                    {trackingBatch.checkpoints.map((cp: any, idx: number) => {
                      const isFirst = idx === 0;
                      const isLast = idx === trackingBatch.checkpoints.length - 1;
                      return (
                        <div key={cp.id} style={{ display: "flex", gap: "var(--space-4)" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px", flexShrink: 0 }}>
                            <div style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: isLast ? "var(--color-primary)" : "var(--color-primary-bg)",
                              color: isLast ? "white" : "var(--color-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              border: "1px solid var(--color-primary)",
                              flexShrink: 0
                            }}>
                              {idx + 1}
                            </div>
                            {!isLast && <div style={{ width: "2px", flexGrow: 1, minHeight: "24px", background: "var(--color-border)" }} />}
                          </div>
                          
                          <div style={{ flexGrow: 1, paddingBottom: "var(--space-4)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{cp.location_name}</span>
                              <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                                {new Date(cp.scanned_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}{" "}
                                {new Date(cp.scanned_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            
                            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "4px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                              {cp.temp_celsius && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <Thermometer size={12} />
                                  Suhu: {cp.temp_celsius}°C
                                </span>
                              )}
                              
                              {cp.visual_condition && (
                                <span style={{
                                  padding: "1px 6px",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "9px",
                                  fontWeight: 700,
                                  background: cp.visual_condition === "excellent" ? "var(--color-success-bg)" :
                                              cp.visual_condition === "good" ? "#EFF6FF" :
                                              cp.visual_condition === "fair" ? "#FEF3C7" : "var(--color-danger-bg)",
                                  color: cp.visual_condition === "excellent" ? "var(--color-success)" :
                                         cp.visual_condition === "good" ? "#1D4ED8" :
                                         cp.visual_condition === "fair" ? "#B45309" : "var(--color-danger)",
                                }}>
                                  Kondisi: {cp.visual_condition === "excellent" ? "Sangat Baik" :
                                            cp.visual_condition === "good" ? "Baik" :
                                            cp.visual_condition === "fair" ? "Cukup" : "Perlu Perhatian"}
                                </span>
                              )}
                            </div>

                            {/* Checkpoint photo & summary */}
                            {cp.photo_url && (
                              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                <img
                                  src={cp.photo_url}
                                  alt={`Foto di ${cp.location_name}`}
                                  style={{ width: "100%", maxWidth: "200px", height: "110px", objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                                {cp.visual_summary && (
                                  <p style={{ margin: 0, fontSize: "10px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                                    "{cp.visual_summary}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginTop: "var(--space-2)" }}>
              <button className="btn btn-secondary" onClick={() => setTrackingBatch(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .batches-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-4);
        }

        .empty-state {
          flex-direction: column;
          padding: var(--space-12) var(--space-6);
        }

        .loading-state {
          padding: var(--space-6) 0;
        }

        /* Table */
        .table-responsive {
          overflow-x: auto;
          width: 100%;
        }

        .batches-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .batches-table th,
        .batches-table td {
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          border-bottom: 1px solid var(--color-border);
        }

        .batches-table th {
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .commodity-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: var(--color-primary-bg);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
        }

        .modal-content {
          width: 100%;
          max-width: 480px;
          background: var(--color-surface);
          box-shadow: var(--shadow-lg);
          padding: var(--space-6);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }

        /* QR Modal */
        .qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
        }

        .qr-card {
          width: 100%;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          background: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
        }

        .qr-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .qr-image {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 8px;
          background: white;
        }

        .qr-meta {
          text-align: center;
        }

        .qr-title {
          font-weight: 700;
          font-size: var(--text-base);
          color: var(--color-text);
        }

        .qr-detail {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .qr-hash {
          font-family: monospace;
          font-size: 9px;
          background: var(--color-muted);
          color: var(--color-text-muted);
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: var(--space-2);
          word-break: break-all;
        }

        .qr-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          width: 100%;
        }
      `}</style>
    </div>
  );
}
