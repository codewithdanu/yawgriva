"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";

interface StatusStepsViewerProps {
  steps: string[];
  isStreamingMessage: boolean;
}

export default function StatusStepsViewer({ steps, isStreamingMessage }: StatusStepsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{ marginBottom: "8px", width: "fit-content" }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: "rgba(21, 107, 60, 0.05)",
          border: "1px solid rgba(21, 107, 60, 0.15)",
          borderRadius: "var(--radius-md)",
          padding: "6px 10px",
          fontSize: "11px",
          color: "var(--color-primary-dark)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 550,
          transition: "all var(--transition-fast)"
        }}
      >
        <span style={{ 
          display: "inline-block", 
          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", 
          transition: "transform 0.2s ease",
          fontSize: "9px"
        }}>▶</span>
        {isStreamingMessage ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Loader2 size={12} className="spin animate-spin" style={{ color: "var(--color-primary)", display: "inline-block" }} />
            <span>AI sedang memproses...</span>
          </div>
        ) : (
          <span>Lihat Detail Aktivitas AI ({steps.length} langkah)</span>
        )}
      </button>

      {isExpanded && (
        <div className="status-steps animate-fade-in" style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "6px", 
          marginTop: "6px",
          padding: "8px 12px", 
          background: "rgba(21, 107, 60, 0.03)", 
          borderLeft: "3px solid var(--color-primary)", 
          borderRadius: "var(--radius-md)", 
          fontSize: "11px", 
          color: "var(--color-primary-dark)",
          width: "100%",
          maxWidth: "500px"
        }}>
          {steps.map((step, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="status-step-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-primary)", display: "inline-block" }}></span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
