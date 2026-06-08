"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import type { DeliveryRequest } from "@/lib/api";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { formatCommodityName } from "@/lib/utils";

export default function DistributorRequestsPage() {
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [declineRequestId, setDeclineRequestId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const data = await api.deliveryRequests.incoming(token);
      setRequests(data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: string) => {
    setActioning(id + "_accept");
    try {
      const token = getToken();
      if (!token) return;
      await api.deliveryRequests.accept(token, id);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "accepted" as const } : r))
      );
    } catch (err: any) {
      alert(err?.message || "Gagal menerima permintaan");
    } finally {
      setActioning(null);
    }
  };

  const handleDecline = (id: string) => {
    setDeclineRequestId(id);
  };

  const executeDecline = async (id: string) => {
    setActioning(id + "_decline");
    try {
      const token = getToken();
      if (!token) return;
      await api.deliveryRequests.decline(token, id);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "declined" as const } : r))
      );
    } catch (err: any) {
      alert(err?.message || "Gagal menolak permintaan");
    } finally {
      setActioning(null);
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Kedaluwarsa";
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs} jam ${mins % 60} menit tersisa`;
    return `${mins} menit tersisa`;
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return { bg: "var(--color-muted)", text: "var(--color-text-muted)" };
    if (score >= 70) return { bg: "var(--color-success-bg)", text: "var(--color-success)" };
    if (score >= 50) return { bg: "#FFF9E6", text: "#B45309" };
    return { bg: "var(--color-danger-bg)", text: "var(--color-danger)" };
  };

  return (
    <div className="requests-page">
      {/* Header */}
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Permintaan Masuk</h1>
          <p className="page-subtitle">Petani menghubungimu untuk mengambil batch mereka</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadRequests} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="skeleton-list">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton request-skeleton" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state card">
          <Inbox size={48} color="var(--color-border)" />
          <h3>Belum ada permintaan</h3>
          <p>Petani akan menghubungimu setelah menemukan kecocokan</p>
        </div>
      ) : (
        <div className="request-list">
          {requests.map((req, idx) => {
            const expired = isExpired(req.expires_at);
            const timeLeft = getTimeRemaining(req.expires_at);
            const scoreColor = getScoreColor(req.match_score);
            const isPending = req.status === "pending" && !expired;

            return (
              <div
                key={req.id}
                className={`request-card card ${req.status === "accepted" ? "card-accepted" : req.status === "declined" || expired ? "card-declined" : ""}`}
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="request-top">
                  {/* Commodity Icon */}
                  <div className="request-icon">
                    <Package size={22} />
                  </div>

                  {/* Info */}
                  <div className="request-info">
                    <div className="request-commodity">
                      {req.commodity_name ? formatCommodityName(req.commodity_name) : "Komoditas tidak diketahui"}
                    </div>
                    <div className="request-meta">
                      {req.quantity_kg && (
                        <span className="meta-tag">{req.quantity_kg.toLocaleString("id-ID")} kg</span>
                      )}
                      <span className="meta-tag">
                        <Clock size={11} />
                        {new Date(req.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Match Score */}
                  {req.match_score !== null && (
                    <div
                      className="match-score-badge"
                      style={{ background: scoreColor.bg, color: scoreColor.text }}
                    >
                      <span className="score-num">{req.match_score?.toFixed(0)}</span>
                      <span className="score-lbl">Skor</span>
                    </div>
                  )}
                </div>

                {/* Timer / Status row */}
                <div className="request-status-row">
                  {req.status === "pending" && !expired && (
                    <div className="timer-badge">
                      <Clock size={13} />
                      <span>{timeLeft}</span>
                    </div>
                  )}
                  {(expired || req.status === "expired") && (
                    <div className="status-badge status-expired">
                      <XCircle size={13} /> Kedaluwarsa
                    </div>
                  )}
                  {req.status === "accepted" && (
                    <div className="status-badge status-accepted">
                      <CheckCircle size={13} /> Diterima — Batch masuk ke transit
                    </div>
                  )}
                  {req.status === "declined" && (
                    <div className="status-badge status-declined">
                      <XCircle size={13} /> Ditolak
                    </div>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <div className="request-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDecline(req.id)}
                        disabled={actioning === req.id + "_decline"}
                      >
                        {actioning === req.id + "_decline" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}{" "}
                        Tolak
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAccept(req.id)}
                        disabled={actioning === req.id + "_accept"}
                      >
                        {actioning === req.id + "_accept" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle size={14} />
                        )}{" "}
                        Terima
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Tolak */}
      {declineRequestId && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <XCircle size={24} color="var(--color-danger)" />
              <h3>Konfirmasi Tolak Permintaan</h3>
            </div>
            <p className="modal-text">Apakah Anda yakin ingin menolak permintaan pengiriman ini?</p>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeclineRequestId(null)}>
                Batal
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  const id = declineRequestId;
                  setDeclineRequestId(null);
                  executeDecline(id);
                }}
              >
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .requests-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          max-width: 680px;
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

        .skeleton-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .request-skeleton {
          height: 120px;
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

        .request-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .request-card {
          padding: var(--space-4) var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          animation: slideUp 0.3s ease both;
        }

        .card-accepted {
          border-color: var(--color-success);
          background: var(--color-success-bg);
        }

        .card-declined {
          opacity: 0.6;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .request-top {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .request-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          background: var(--color-primary-bg);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .request-info { flex: 1; }

        .request-commodity {
          font-size: var(--text-base);
          font-weight: 700;
          text-transform: capitalize;
        }

        .request-meta {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-1);
          flex-wrap: wrap;
        }

        .meta-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--color-muted);
          color: var(--color-text-muted);
        }

        .match-score-badge {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-full);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .score-num {
          font-size: var(--text-lg);
          font-weight: 800;
          line-height: 1;
        }

        .score-lbl {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .request-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .timer-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: #FEF9C3;
          color: #854D0E;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-full);
        }

        .status-accepted {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .status-declined, .status-expired {
          background: var(--color-muted);
          color: var(--color-text-muted);
        }

        .request-actions {
          display: flex;
          gap: var(--space-2);
          margin-left: auto;
        }

        .animate-spin { animation: spin 1s linear infinite; }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.2s ease both;
        }

        .modal-card {
          width: 90%;
          max-width: 400px;
          background: var(--color-surface);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          box-shadow: var(--shadow-lg);
          animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .modal-header h3 {
          font-size: var(--text-base);
          font-weight: 700;
          margin: 0;
        }

        .modal-text {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          line-height: 1.5;
          margin: 0;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
      `}</style>
    </div>
  );
}
