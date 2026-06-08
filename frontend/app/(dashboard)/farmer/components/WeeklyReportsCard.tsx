"use client";

import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { api, WeeklyReportItem } from "@/lib/api";
import { getToken } from "@/lib/auth";
import styles from "../page.module.css";

interface WeeklyReportsCardProps {
  weeklyReports: WeeklyReportItem[];
}

export default function WeeklyReportsCard({ weeklyReports }: WeeklyReportsCardProps) {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<Record<string, string>>({});

  const handleExpandReport = async (reportId: string) => {
    if (expandedReport === reportId) {
      setExpandedReport(null);
      return;
    }
    setExpandedReport(reportId);
    if (!reportDetail[reportId]) {
      const token = getToken();
      if (!token) return;
      try {
        const detail = await api.farmerReports.get(token, reportId);
        setReportDetail(prev => ({ ...prev, [reportId]: detail.report_text }));
      } catch (err) {
        console.error("Failed to load report detail:", err);
      }
    }
  };

  return (
    <div className="card">
      <div className={styles.cardHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={18} color="var(--color-primary)" />
          </div>
          <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Laporan Mingguan</h2>
        </div>
        <Link href="/farmer/reports" className="btn btn-ghost btn-sm">
          Semua &rarr;
        </Link>
      </div>

      {weeklyReports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
          <FileText size={32} color="var(--color-border)" style={{ margin: "0 auto var(--space-2)" }} />
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>Laporan pertama dikirim Senin depan</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {weeklyReports.map((report) => (
            <div key={report.id} className={styles.reportAccordion}>
              <button
                className={styles.reportAccordionHeader}
                onClick={() => handleExpandReport(report.id)}
              >
                <div>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    Minggu {new Date(report.week_start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – {new Date(report.week_end).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {report.summary && (
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2, marginBottom: 0, textAlign: "left" }}>
                      {report.summary}
                    </p>
                  )}
                </div>
                {expandedReport === report.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedReport === report.id && (
                <div className={styles.reportAccordionBody}>
                  {reportDetail[report.id] ? (
                    <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, whiteSpace: "pre-line", margin: 0 }}>
                      {reportDetail[report.id]}
                    </p>
                  ) : (
                    <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-md)" }} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
