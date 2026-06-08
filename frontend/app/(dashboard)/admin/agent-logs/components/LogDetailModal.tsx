import React from "react";
import { AgentLog } from "@/lib/api";
import MarkdownRenderer from "@/components/shared/MarkdownRenderer";
import styles from "../page.module.css";

interface LogDetailModalProps {
  selectedLog: AgentLog;
  onClose: () => void;
  getAgentColor: (type: string) => { bg: string; text: string; border: string };
}

export default function LogDetailModal({ selectedLog, onClose, getAgentColor }: LogDetailModalProps) {
  const colors = getAgentColor(selectedLog.agent_type);
  
  return (
    <div className={`${styles.modalBackdrop} ${styles.animateFadeIn}`} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles.animateScaleIn}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Detail Log Aktivitas Agent</h3>
            <p className={styles.modalSubtitle}>ID: {selectedLog.id}</p>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* Metadata Cards */}
          <div className={styles.modalMetaGrid}>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Waktu</span>
              <span className={styles.metaValue}>
                {new Date(selectedLog.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })} - {new Date(selectedLog.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Agent</span>
              <span className={styles.metaValue} style={{ textTransform: "uppercase", fontWeight: 700, color: colors.text }}>
                {selectedLog.agent_type}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Model AI</span>
              <span className={styles.metaValue}>{selectedLog.model_used || "-"}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Latency</span>
              <span className={styles.metaValue} style={{ color: "var(--color-primary)", fontWeight: 700 }}>
                {selectedLog.latency_ms !== null ? `${selectedLog.latency_ms} ms` : "-"}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Tokens</span>
              <span className={styles.metaValue}>{selectedLog.tokens_used !== null ? selectedLog.tokens_used : "-"}</span>
            </div>
          </div>

          {/* Formatted Response */}
          <div className={styles.responseContainer}>
            <h4 className={styles.responseTitle}>Ringkasan Respons Lengkap</h4>
            <div className={styles.responseScrollbox}>
              <MarkdownRenderer content={selectedLog.output_summary || ""} />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
