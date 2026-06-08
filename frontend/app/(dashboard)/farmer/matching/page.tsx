"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import type { MatchCandidate, DeliveryRequest } from "@/lib/api";
import { Users, MapPin, Star, CheckCircle, ArrowLeft, Send, Loader2, Package, XCircle } from "lucide-react";
import Link from "next/link";
import { formatCommodityName } from "@/lib/utils";

interface Batch {
  id: string;
  commodity_name: string;
  quantity_kg: number;
  status: string;
  harvest_date: string;
}

export default function FarmerMatchingPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [batchRequests, setBatchRequests] = useState<DeliveryRequest[]>([]);

  // Farmer location coords — read from profile on mount, fall back to Wonosobo if not set
  const [farmerCoords, setFarmerCoords] = useState<{ lat: number; lng: number }>({
    lat: -7.3305,
    lng: 109.9839,
  });

  useEffect(() => {
    loadBatches();
    loadFarmerCoords();
  }, []);

  const loadFarmerCoords = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const profile = await api.auth.getProfile(token);
      if (profile.farmer_profile?.latitude && profile.farmer_profile?.longitude) {
        setFarmerCoords({
          lat: Number(profile.farmer_profile.latitude),
          lng: Number(profile.farmer_profile.longitude),
        });
      }
    } catch (err) {
      console.error("Failed to load farmer profile coordinates:", err);
    }
  };

  const loadBatches = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const data = await api.batches.list(token);
      const readyBatches = data.filter((b: any) => b.status === "registered");
      setBatches(readyBatches);
      if (readyBatches.length > 0) setSelectedBatch(readyBatches[0]);
    } catch {
      // fail silently
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (selectedBatch) {
      loadCandidates(selectedBatch);
    }
  }, [selectedBatch, farmerCoords]);

  const loadCandidates = async (batch: Batch) => {
    setLoadingCandidates(true);
    setCandidates([]);
    try {
      const token = getToken();
      if (!token) return;
      const [candidatesData, requestsData] = await Promise.all([
        api.batches.getMatchCandidates(token, batch.id, farmerCoords.lat, farmerCoords.lng),
        api.deliveryRequests.list(token, batch.id)
      ]);
      setCandidates(candidatesData);
      setBatchRequests(requestsData);
    } catch (err: any) {
      console.error("Failed to load candidates and requests:", err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSelectBatch = (batch: Batch) => {
    setSelectedBatch(batch);
  };

  const handleSendRequest = async (candidate: MatchCandidate) => {
    if (!selectedBatch) return;
    setSendingRequest(candidate.distributor_id);
    try {
      const token = getToken();
      if (!token) return;
      const newReq = await api.deliveryRequests.create(token, {
        batch_id: selectedBatch.id,
        distributor_id: candidate.distributor_id,
        match_score: candidate.match_score,
      });
      setBatchRequests((prev) => [...prev, newReq]);
    } catch (err: any) {
      alert(err?.message || "Gagal mengirim permintaan");
    } finally {
      setSendingRequest(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return { bg: "var(--color-success-bg)", text: "var(--color-success)" };
    if (score >= 50) return { bg: "#FFF9E6", text: "#B45309" };
    return { bg: "var(--color-danger-bg)", text: "var(--color-danger)" };
  };

  return (
    <div className="matching-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cari Distributor</h1>
          <p className="page-subtitle">AI mencocokkan distributor terbaik berdasarkan jarak, performa, dan ketersediaan</p>
        </div>
      </div>

      {/* Batch Selector */}
      <div className="card">
        <h2 className="section-title">Pilih Batch</h2>
        {loadingBatches ? (
          <div className="skeleton" style={{ height: 60 }} />
        ) : batches.length === 0 ? (
          <div className="empty-small">
            <Package size={24} color="var(--color-border)" />
            <p>Tidak ada batch dengan status &ldquo;Terdaftar&rdquo;</p>
            <Link href="/farmer/batches" className="btn btn-primary btn-sm">Buat Batch Baru</Link>
          </div>
        ) : (
          <div className="batch-selector">
            {batches.map((batch) => (
              <button
                key={batch.id}
                className={`batch-chip ${selectedBatch?.id === batch.id ? "batch-chip-active" : ""}`}
                onClick={() => handleSelectBatch(batch)}
              >
                <Package size={14} />
                <span>{formatCommodityName(batch.commodity_name)}</span>
                <span className="chip-qty">{batch.quantity_kg} kg</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Candidates */}
      {selectedBatch && (
        <div className="candidates-section">
          <div className="candidates-header">
            <h2 className="section-title">Top 3 Distributor untuk {formatCommodityName(selectedBatch.commodity_name)}</h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => loadCandidates(selectedBatch)}
              disabled={loadingCandidates}
            >
              {loadingCandidates ? <Loader2 size={16} className="animate-spin" /> : "Refresh"}
            </button>
          </div>

          {loadingCandidates ? (
            <div className="skeleton-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton candidate-skeleton" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="empty-state">
              <Users size={40} color="var(--color-border)" />
              <h3>Tidak ada distributor tersedia</h3>
              <p>Tidak ada distributor dalam radius 50km yang tersedia saat ini</p>
            </div>
          ) : (
            <div className="candidate-list">
              {candidates.map((c, idx) => {
                const scoreColor = getScoreColor(c.match_score);
                const existingReq = batchRequests.find((r) => r.distributor_id === c.distributor_id);
                const isSent = !!existingReq;
                const reqStatus = existingReq?.status;
                const isSending = sendingRequest === c.distributor_id;
                const rank = idx + 1;

                return (
                  <div key={c.distributor_id} className="candidate-card card" style={{ animationDelay: `${idx * 0.08}s` }}>
                    {/* Rank badge */}
                    <div className={`rank-badge ${rank === 1 ? "rank-gold" : rank === 2 ? "rank-silver" : "rank-bronze"}`}>
                      #{rank}
                    </div>

                    <div className="candidate-body">
                      {/* Left: Info */}
                      <div className="candidate-info">
                        <div className="candidate-avatar" style={{ overflow: "hidden", background: "none" }}>
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.distributor_name)}&background=1B4332&color=ffffff&size=96&bold=true&rounded=true&format=png`} alt={c.distributor_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div>
                          <h3 className="candidate-name">{c.distributor_name}</h3>
                          <div className="candidate-tags">
                            <span className="tag">
                              <MapPin size={11} /> {c.distance_km} km
                            </span>
                            <span className="tag">
                              <Star size={11} /> {c.total_deliveries} pengiriman
                            </span>
                            {c.is_available ? (
                              <span className="tag tag-green"><CheckCircle size={11} /> Tersedia</span>
                            ) : (
                              <span className="tag tag-gray">Sedang Aktif</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Score + Action */}
                      <div className="candidate-right">
                        <div className="score-circle" style={{ background: scoreColor.bg, color: scoreColor.text }}>
                          <span className="score-number">{c.match_score.toFixed(0)}</span>
                          <span className="score-label">Match</span>
                        </div>

                        {/* Score breakdown */}
                        <div className="score-breakdown">
                          <div className="score-bar-item">
                            <span>Jarak</span>
                            <div className="score-bar">
                              <div className="score-bar-fill score-bar-blue" style={{ width: `${(c.distance_score / 40) * 100}%` }} />
                            </div>
                            <span>{c.distance_score.toFixed(0)}</span>
                          </div>
                          <div className="score-bar-item">
                            <span>Performa</span>
                            <div className="score-bar">
                              <div className="score-bar-fill score-bar-green" style={{ width: `${(c.performance_score / 40) * 100}%` }} />
                            </div>
                            <span>{c.performance_score.toFixed(0)}</span>
                          </div>
                          <div className="score-bar-item">
                            <span>Ketersediaan</span>
                            <div className="score-bar">
                              <div className="score-bar-fill score-bar-purple" style={{ width: `${(c.availability_score / 20) * 100}%` }} />
                            </div>
                            <span>{c.availability_score.toFixed(0)}</span>
                          </div>
                        </div>

                        {isSending ? (
                          <button className="btn btn-secondary btn-sm" disabled style={{ width: "100%" }}>
                            <Loader2 size={14} className="animate-spin" /> Mengirim...
                          </button>
                        ) : existingReq ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{
                              width: "100%",
                              cursor: "not-allowed",
                              background:
                                reqStatus === "accepted"
                                  ? "var(--color-success-bg)"
                                  : reqStatus === "declined"
                                  ? "var(--color-danger-bg)"
                                  : "var(--color-muted)",
                              color:
                                reqStatus === "accepted"
                                  ? "var(--color-success)"
                                  : reqStatus === "declined"
                                  ? "var(--color-danger)"
                                  : "var(--color-text-muted)",
                              borderColor:
                                reqStatus === "accepted"
                                  ? "var(--color-success)"
                                  : reqStatus === "declined"
                                  ? "var(--color-danger)"
                                  : "var(--color-border)",
                            }}
                            disabled
                          >
                            {reqStatus === "accepted" && <><CheckCircle size={14} /> Diterima</>}
                            {reqStatus === "declined" && <><XCircle size={14} /> Ditolak</>}
                            {reqStatus === "pending" && <><CheckCircle size={14} /> Sudah Dihubungi</>}
                            {reqStatus === "expired" && <><XCircle size={14} /> Kedaluwarsa</>}
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSendRequest(c)}
                            disabled={!c.is_available}
                            style={{ width: "100%" }}
                          >
                            <Send size={14} /> Hubungi
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .matching-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          max-width: 800px;
          margin: 0 auto;
          padding: var(--space-6);
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .page-title {
          font-size: var(--text-2xl);
          font-weight: 800;
          margin: 0;
        }

        .page-subtitle {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          margin: var(--space-1) 0 0;
        }

        .section-title {
          font-size: var(--text-base);
          font-weight: 700;
          margin: 0 0 var(--space-4);
        }

        .batch-selector {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .batch-chip {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-full);
          background: transparent;
          cursor: pointer;
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-text);
          transition: all 0.15s;
        }

        .batch-chip:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-bg);
        }

        .batch-chip-active {
          border-color: var(--color-primary);
          background: var(--color-primary-bg);
          color: var(--color-primary);
        }

        .chip-qty {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .empty-small {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          color: var(--color-text-muted);
          font-size: var(--text-sm);
        }

        .candidates-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }

        .skeleton-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .candidate-skeleton {
          height: 160px;
          border-radius: var(--radius-xl);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-12) var(--space-6);
          text-align: center;
          color: var(--color-text-muted);
        }

        .empty-state h3 {
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .empty-state p { font-size: var(--text-sm); }

        .candidate-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .candidate-card {
          position: relative;
          padding: var(--space-5);
          animation: slideUp 0.3s ease both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rank-badge {
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          width: 28px;
          height: 28px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-xs);
          font-weight: 800;
        }

        .rank-gold { background: #FEF3C7; color: #92400E; }
        .rank-silver { background: #F1F5F9; color: #475569; }
        .rank-bronze { background: #FEF0EA; color: #9A3412; }

        .candidate-body {
          display: flex;
          gap: var(--space-6);
          align-items: flex-start;
        }

        .candidate-info {
          display: flex;
          gap: var(--space-3);
          align-items: flex-start;
          flex: 1;
        }

        .candidate-avatar {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-mid));
          color: white;
          font-size: var(--text-xl);
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .candidate-name {
          font-size: var(--text-base);
          font-weight: 700;
          margin: 0 0 var(--space-2);
        }

        .candidate-tags {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--color-muted);
          color: var(--color-text-muted);
        }

        .tag-green { background: var(--color-success-bg); color: var(--color-success); }
        .tag-gray { background: var(--color-muted); color: var(--color-text-muted); }

        .candidate-right {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          min-width: 160px;
        }

        .score-circle {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-full);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .score-number {
          font-size: var(--text-xl);
          font-weight: 800;
          line-height: 1;
        }

        .score-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .score-breakdown {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .score-bar-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 10px;
          color: var(--color-text-muted);
        }

        .score-bar-item > span:first-child {
          width: 70px;
          flex-shrink: 0;
        }

        .score-bar-item > span:last-child {
          width: 20px;
          text-align: right;
          font-weight: 600;
          color: var(--color-text);
        }

        .score-bar {
          flex: 1;
          height: 6px;
          background: var(--color-border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .score-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }

        .score-bar-blue { background: #3B82F6; }
        .score-bar-green { background: var(--color-primary); }
        .score-bar-purple { background: #8B5CF6; }

        .animate-spin { animation: spin 1s linear infinite; }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .candidate-body { flex-direction: column; }
          .candidate-right { min-width: unset; width: 100%; flex-direction: row; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
