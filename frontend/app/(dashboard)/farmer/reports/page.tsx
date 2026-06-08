"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import type { WeeklyReportItem, WeeklyReportDetail } from "@/lib/api";
import { FileText, ChevronDown, ChevronUp, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function FarmerReportsPage() {
  const [reports, setReports] = useState<WeeklyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WeeklyReportDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const data = await api.farmerReports.list(token);
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      setLoadingDetail(id);
      try {
        const token = getToken();
        if (!token) return;
        const detail = await api.farmerReports.get(token, id);
        setDetails((prev) => ({ ...prev, [id]: detail }));
      } catch {
        // fail silently
      } finally {
        setLoadingDetail(null);
      }
    }
  };

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Laporan Mingguan</h1>
          <p className="page-subtitle">Dihasilkan setiap Senin pagi oleh AI berdasarkan aktivitas kebunmu</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadReports} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton report-skeleton" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} color="var(--color-border)" />
          <h3>Belum ada laporan</h3>
          <p>Laporan pertamamu akan muncul di sini setiap Senin setelah ada aktivitas batch</p>
        </div>
      ) : (
        <div className="report-list">
          {reports.map((report, idx) => {
            const detail = details[report.id];
            const isExpanded = expanded === report.id;
            const isLoadingThis = loadingDetail === report.id;

            return (
              <div key={report.id} className="report-card card" style={{ animationDelay: `${idx * 0.05}s` }}>
                <button className="report-header" onClick={() => handleExpand(report.id)}>
                  <div className="report-meta">
                    <div className="report-week-badge">
                      <FileText size={16} />
                      <span>
                        {new Date(report.week_start).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                        })}{" "}
                        –{" "}
                        {new Date(report.week_end).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {report.summary && (
                      <p className="report-summary">{report.summary}</p>
                    )}
                  </div>
                  <div className="report-chevron">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="report-body">
                    {isLoadingThis ? (
                      <div className="skeleton" style={{ height: 120, borderRadius: "var(--radius-md)" }} />
                    ) : detail ? (
                      <>
                        <div className="report-ai-badge">
                          <span>✨ Dihasilkan oleh AI</span>
                        </div>
                        <p className="report-text">{detail.report_text}</p>
                        <p className="report-generated">
                          Diterbitkan:{" "}
                          {new Date(detail.created_at).toLocaleDateString("id-ID", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </>
                    ) : (
                      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                        Gagal memuat laporan.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .reports-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          max-width: 720px;
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

        .report-skeleton {
          height: 80px;
          border-radius: var(--radius-lg);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-16) var(--space-6);
          text-align: center;
          color: var(--color-text-muted);
        }

        .empty-state h3 {
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .empty-state p {
          font-size: var(--text-sm);
          max-width: 320px;
        }

        .report-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .report-card {
          padding: 0;
          overflow: hidden;
          animation: slideUp 0.3s ease both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .report-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-4) var(--space-5);
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          color: var(--color-text);
          transition: background 0.15s;
        }

        .report-header:hover {
          background: var(--color-muted);
        }

        .report-meta {
          flex: 1;
          min-width: 0;
        }

        .report-week-badge {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: 600;
          font-size: var(--text-base);
          color: var(--color-text);
        }

        .report-week-badge svg {
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .report-summary {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          margin: var(--space-1) 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .report-chevron {
          color: var(--color-text-muted);
          flex-shrink: 0;
        }

        .report-body {
          padding: var(--space-5);
          border-top: 1px solid var(--color-border);
          background: var(--color-muted);
          animation: expandIn 0.2s ease;
        }

        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 1000px; }
        }

        .report-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: 2px 10px;
          border-radius: var(--radius-full);
          background: var(--color-primary-bg);
          color: var(--color-primary);
          font-size: var(--text-xs);
          font-weight: 600;
          margin-bottom: var(--space-3);
        }

        .report-text {
          font-size: var(--text-sm);
          line-height: 1.8;
          white-space: pre-line;
          color: var(--color-text);
        }

        .report-generated {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: var(--space-4);
          padding-top: var(--space-3);
          border-top: 1px solid var(--color-border);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
