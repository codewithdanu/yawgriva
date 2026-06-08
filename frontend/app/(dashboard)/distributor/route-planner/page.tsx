"use client";

import { useState, useEffect } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Navigation,
  CheckCircle,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Thermometer,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

const ROUTE_PLANNING_STEPS = [
  "Mengklasifikasikan maksud rute pengiriman...",
  "Menghubungi Google Maps Directions API...",
  "Menganalisis ramalan cuaca lokasi tujuan...",
  "Menghitung estimasi degradasi kesegaran produk hortikultura...",
  "Menyusun rekomendasi tips dari Logistics Agent..."
];

// Common target market coordinates in Java
const DESTINATION_MARKETS = [
  { value: "pasar_kramat_jati", label: "Pasar Induk Kramat Jati, Jakarta", lat: -6.2847, lng: 106.8718 },
  { value: "pasar_caringin", label: "Pasar Induk Caringin, Bandung", lat: -6.9458, lng: 107.5753 },
  { value: "pasar_gede", label: "Pasar Gede, Solo", lat: -7.5689, lng: 110.8294 },
  { value: "pasar_legi", label: "Pasar Legi, Surabaya", lat: -7.2625, lng: 112.7411 },
];

function parseInlineMarkdown(text: string): React.ReactNode {
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} style={{ fontWeight: 600, color: "var(--color-text)" }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export default function RoutePlannerPage() {
  const router = useRouter();
  
  // Available batches list
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  
  // Selected batch & coordinates
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  
  // Target destination market
  const [destValue, setDestValue] = useState(DESTINATION_MARKETS[0].value);
  
  // Calculations result state
  const [calculating, setCalculating] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [routeResult, setRouteResult] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const fetchRegisteredBatches = async () => {
      try {
        const token = getToken();
        if (!token) return;
        
        // List all batches and filter for those still in 'registered' status (not yet in transit/done)
        const allBatches = await api.batches.list(token);
        const registered = allBatches.filter((b: any) => b.status === "registered");
        setBatches(registered);
        
        if (registered.length > 0) {
          setSelectedBatchId(registered[0].id);
          setSelectedBatch(registered[0]);
        }
      } catch (err: any) {
        setError("Gagal mengambil daftar batch tersedia.");
      } finally {
        setLoadingBatches(false);
      }
    };

    fetchRegisteredBatches();
  }, []);

  const handleBatchChange = (id: string) => {
    setSelectedBatchId(id);
    setSelectedBatch(batches.find((b) => b.id === id) || null);
    setRouteResult(null); // Clear previous route calculations
  };

  const handleCalculateRoute = async () => {
    if (!selectedBatch) return;
    
    setCalculating(true);
    setError("");
    setRouteResult(null);
    
    // Simulate multi-agent checklist statuses for amazing UX
    const statuses = [
      "Mengklasifikasikan maksud rute pengiriman...",
      "Menghubungi Google Maps Directions API...",
      "Menganalisis ramalan cuaca lokasi tujuan...",
      "Menghitung estimasi degradasi kesegaran produk hortikultura...",
      "Menyusun rekomendasi tips dari Logistics Agent..."
    ];
    
    let statusIndex = 0;
    setStatusMessage(ROUTE_PLANNING_STEPS[0]);
    setCurrentStepIdx(0);
    
    const interval = setInterval(() => {
      if (statusIndex < ROUTE_PLANNING_STEPS.length - 1) {
        statusIndex++;
        setStatusMessage(ROUTE_PLANNING_STEPS[statusIndex]);
        setCurrentStepIdx(statusIndex);
      }
    }, 900);
    
    try {
      const token = getToken();
      if (!token) return;
      
      const destMarket = DESTINATION_MARKETS.find((m) => m.value === destValue);
      if (!destMarket) return;
      
      // Default coordinates for origin if not present in profile: Ciwidey Bandung area (-7.1004, 107.4529)
      const originLat = -7.1004;
      const originLng = 107.4529;
      
      const cacheKey = `yawgriva_route_${selectedBatch.id}_${originLat}_${originLng}_${destMarket.lat}_${destMarket.lng}`;
      const cachedResult = localStorage.getItem(cacheKey);
      
      if (cachedResult) {
        // Short simulation delay for beautiful loader UX
        await new Promise((resolve) => setTimeout(resolve, 600));
        clearInterval(interval);
        setRouteResult(JSON.parse(cachedResult));
        return;
      }
      
      const result = await api.agents.route(token, {
        batch_id: selectedBatch.id,
        origin_lat: originLat,
        origin_lng: originLng,
        destination_lat: destMarket.lat,
        destination_lng: destMarket.lng,
      });
      
      localStorage.setItem(cacheKey, JSON.stringify(result));
      clearInterval(interval);
      setRouteResult(result);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Gagal menghitung rekomendasi rute.");
    } finally {
      setCalculating(false);
    }
  };

  const handleStartShipment = async () => {
    if (!selectedBatch || !routeResult) return;
    
    setConfirming(true);
    setError("");
    
    try {
      const token = getToken();
      if (!token) return;
      
      // 1. Update status of the batch to 'in_transit'
      await api.batches.updateStatus(token, selectedBatch.id, "in_transit");
      
      // 1b. Calculate and save carbon footprint to database
      try {
        await api.batches.getCarbon(token, selectedBatch.id, routeResult.distance_km, "mobil_boks");
      } catch (carbonErr) {
        console.error("Gagal menghitung emisi karbon:", carbonErr);
      }
      
      // 2. Save destination details to localStorage for Gojek-like map tracking
      const destMarket = DESTINATION_MARKETS.find((m) => m.value === destValue);
      if (destMarket) {
        localStorage.setItem(`batch_destination_${selectedBatch.id}`, JSON.stringify(destMarket));
      }
      
      // 3. Create the first DistributionCheckpoint at the origin
      await api.checkpoints.create(token, {
        batch_id: selectedBatch.id,
        location_name: "Kebun Asal (Keberangkatan)",
        latitude: -7.1004,
        longitude: 107.4529,
        temp_celsius: 22.5, // Standard morning/mountain temperature
      });
      
      // Redirect back to distributor dashboard
      router.push("/distributor");
    } catch (err: any) {
      setError(err.message || "Gagal memulai pengiriman.");
      setConfirming(false);
    }
  };

  const getFreshnessColor = (score: number) => {
    if (score >= 0.85) return "var(--color-success)";
    if (score >= 0.70) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getFreshnessBg = (score: number) => {
    if (score >= 0.85) return "var(--color-success-bg)";
    if (score >= 0.70) return "var(--color-warning-bg)";
    return "var(--color-danger-bg)";
  };

  return (
    <div className="route-planner-page">
      {/* Header */}
      <div className="page-header animate-fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Link href="/distributor" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontSize: "var(--text-xl)" }}>Rencana Pengiriman AI</h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
              Optimalkan rute pengiriman dan pertahankan kualitas kesegaran komoditas Anda
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="card text-danger animate-fade-in" style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--color-danger-bg)", borderColor: "var(--color-danger)", padding: "var(--space-4)" }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="section-grid">
        {/* Input Panel */}
        <div className="card animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-4)" }}>Parameter Pengiriman</h3>
          
          {loadingBatches ? (
            <div className="skeleton-container">
              <div className="skeleton" style={{ height: "40px", marginBottom: "12px" }} />
              <div className="skeleton" style={{ height: "40px" }} />
            </div>
          ) : batches.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={32} color="var(--color-text-muted)" />
              <p style={{ textAlign: "center", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: "8px" }}>
                Tidak ada batch produk dengan status "Terdaftar" saat ini yang siap untuk dikirim.
              </p>
              <Link href="/distributor" className="btn btn-secondary" style={{ marginTop: "16px", width: "100%" }}>
                Kembali ke Dashboard
              </Link>
            </div>
          ) : (
            <div className="planner-form">
              <div className="form-group">
                <label className="label">Pilih Batch Produk</label>
                <select
                  className="input"
                  value={selectedBatchId}
                  onChange={(e) => handleBatchChange(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.commodity_name.replace(/_/g, " ").toUpperCase()} ({b.quantity_kg} kg) - ID: {b.id.slice(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Titik Asal Kebun (Farmer)</label>
                <div className="input disabled-input">
                  <MapPin size={16} color="var(--color-primary)" />
                  <span>Cipanas/Ciwidey, Jawa Barat (Pertanian)</span>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Pasar Induk Tujuan</label>
                <select
                  className="input"
                  value={destValue}
                  onChange={(e) => setDestValue(e.target.value)}
                >
                  {DESTINATION_MARKETS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "12px" }}
                disabled={calculating || confirming}
                onClick={handleCalculateRoute}
              >
                {calculating ? "Menghitung Rute AI..." : "Hitung Rute & Kesegaran"}
              </button>
            </div>
          )}
        </div>

        {/* Calculation Result Panel */}
        <div className="calculation-results">
          {calculating && (
            <div className="card loading-card flex-center animate-fade-in" style={{ padding: "var(--space-8)", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "420px", justifyContent: "center" }}>
              <div className="spinner-container">
                <div className="outer-ring" />
                <div className="inner-ring" />
                <div className="center-dot" />
              </div>
              
              <h4 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-primary-dark)", marginTop: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                Yawgriva Orchestrator Aktif
              </h4>
              
              {/* Agent checklist steps */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-2)", background: "var(--color-muted)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
                {ROUTE_PLANNING_STEPS.map((stepText, idx) => {
                  const isCompleted = idx < currentStepIdx;
                  const isActive = idx === currentStepIdx;
                  
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "var(--space-3)", 
                        padding: "6px 10px", 
                        borderRadius: "var(--radius-md)",
                        background: isActive ? "var(--color-primary-bg)" : "transparent",
                        border: isActive ? "1px solid rgba(45, 155, 107, 0.2)" : "1px solid transparent",
                        transition: "all var(--transition-base)"
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
                      ) : isActive ? (
                        <Loader2 className="animate-spin" size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      ) : (
                        <span style={{ 
                          width: "8px", 
                          height: "8px", 
                          borderRadius: "50%", 
                          background: "var(--color-border)", 
                          margin: "0 4px",
                          flexShrink: 0 
                        }} />
                      )}
                      <span style={{ 
                        fontSize: "var(--text-xs)", 
                        fontWeight: isActive ? 600 : 500,
                        color: isActive 
                          ? "var(--color-primary-dark)" 
                          : isCompleted 
                            ? "var(--color-text)" 
                            : "var(--color-text-muted)" 
                      }}>
                        {stepText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!calculating && !routeResult && !error && selectedBatch && (
            <div className="card initial-card flex-center animate-fade-in">
              <Truck size={48} color="var(--color-border)" style={{ marginBottom: "12px" }} />
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                Pilih parameter pengiriman di sebelah kiri, lalu tekan tombol untuk memulai perencanaan rute otomatis.
              </p>
            </div>
          )}

          {!calculating && routeResult && (
            <div className="card result-card animate-fade-in">
              <div className="result-header">
                <span className="badge badge-primary">Rekomendasi Rute Terbaik</span>
                <h3 style={{ fontSize: "var(--text-base)", marginTop: "var(--space-1)" }}>
                  {routeResult.recommended_route}
                </h3>
              </div>

              {/* Metrics Row */}
              <div className="metrics-row">
                <div className="metric-box">
                  <Navigation size={18} color="var(--color-primary)" />
                  <div className="metric-val">{routeResult.distance_km} km</div>
                  <div className="metric-lbl">Jarak Pengiriman</div>
                </div>
                <div className="metric-box">
                  <Clock size={18} color="var(--color-primary)" />
                  <div className="metric-val">
                    {Math.floor(routeResult.estimated_duration_min / 60)}j {Math.round(routeResult.estimated_duration_min % 60)}m
                  </div>
                  <div className="metric-lbl">Waktu Transit</div>
                </div>
                <div
                  className="metric-box"
                  style={{
                    background: getFreshnessBg(routeResult.freshness_score),
                    borderColor: getFreshnessColor(routeResult.freshness_score),
                  }}
                >
                  <Thermometer size={18} color={getFreshnessColor(routeResult.freshness_score)} />
                  <div className="metric-val" style={{ color: getFreshnessColor(routeResult.freshness_score) }}>
                    {Math.round(routeResult.freshness_score * 100)}%
                  </div>
                  <div className="metric-lbl" style={{ color: getFreshnessColor(routeResult.freshness_score), fontWeight: 600 }}>
                    Kesegaran Tiba
                  </div>
                </div>
              </div>

              {/* Operational Tips */}
              <div className="tips-section">
                <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "8px" }}>
                  Instruksi Transit (Logistics Agent)
                </h4>
                <ul className="tips-list">
                  {routeResult.tips.map((tip: string, idx: number) => (
                    <li key={idx} className="tip-item">
                      <span className="tip-bullet" />
                      <span>{parseInlineMarkdown(tip)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action */}
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "16px" }}
                disabled={confirming}
                onClick={handleStartShipment}
              >
                {confirming ? "Menjalankan Pengiriman..." : "Konfirmasi & Mulai Pengiriman"}
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .route-planner-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .section-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: var(--space-6);
          align-items: start;
        }

        .planner-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .disabled-input {
          background: var(--color-muted);
          color: var(--color-text-muted);
          border-color: var(--color-border);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          cursor: not-allowed;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-8) 0;
        }

        /* Results */
        .calculation-results {
          min-height: 300px;
        }

        .initial-card {
          flex-direction: column;
          padding: var(--space-12) var(--space-6);
          border-style: dashed;
          text-align: center;
          color: var(--color-text-muted);
        }

        .loading-card {
          flex-direction: column;
          padding: var(--space-12) var(--space-6);
          min-height: 350px;
        }

        .pulse-loader {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-full);
          background: var(--color-primary-bg);
          border: 3px solid var(--color-primary);
          animation: pulse-soft 1.2s infinite ease-in-out;
        }

        /* Premium Spinner Container */
        .spinner-container {
          position: relative;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-4);
        }
        .outer-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top-color: var(--color-primary);
          border-bottom-color: var(--color-primary-mid);
          border-radius: var(--radius-full);
          animation: spin-clockwise 1.5s linear infinite;
        }
        .inner-ring {
          position: absolute;
          width: 70%;
          height: 70%;
          border: 3px solid transparent;
          border-left-color: var(--color-primary-mid);
          border-right-color: var(--color-primary-bg);
          border-radius: var(--radius-full);
          animation: spin-counter-clockwise 1s linear infinite;
        }
        .center-dot {
          width: 12px;
          height: 12px;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          box-shadow: 0 0 12px var(--color-primary-mid);
          animation: pulse-dot 1s ease-in-out infinite alternate;
        }
        
        @keyframes spin-clockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-counter-clockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes pulse-dot {
          0% { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1.15); opacity: 1; }
        }

        .sub-loader {
          font-size: 10px;
          color: var(--color-primary-mid);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .result-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .result-header {
          border-bottom: 1px solid var(--color-border);
          padding-bottom: var(--space-3);
        }

        .metrics-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-3);
        }

        .metric-box {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: var(--color-muted);
        }

        .metric-val {
          font-size: var(--text-base);
          font-weight: 700;
          color: var(--color-text);
        }

        .metric-lbl {
          font-size: 9px;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tips-section {
          background: var(--color-muted);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          border-left: 3px solid var(--color-primary);
        }

        .tips-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .tip-item {
          font-size: var(--text-xs);
          line-height: 1.5;
          color: var(--color-text);
          display: flex;
          align-items: flex-start;
          gap: var(--space-2);
        }

        .tip-bullet {
          width: 6px;
          height: 6px;
          background: var(--color-primary-mid);
          border-radius: var(--radius-full);
          flex-shrink: 0;
          margin-top: 5px;
        }

        @media (max-width: 768px) {
          .section-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
