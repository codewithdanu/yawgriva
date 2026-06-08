"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PredictionPoint {
  predicted_price: number;
  confidence: number;
  predicted_for: string;
}

interface PricePredictionChartProps {
  predictions: PredictionPoint[];
  commodityName: string;
}

export default function PricePredictionChart({
  predictions,
  commodityName,
}: PricePredictionChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  if (!predictions || predictions.length === 0) {
    return (
      <div className="chart-placeholder flex-center">
        <p style={{ color: "var(--color-text-muted)" }}>Tidak ada data prediksi tersedia.</p>
        <style jsx>{`
          .chart-placeholder {
            height: 250px;
            background: var(--color-muted);
            border-radius: var(--radius-lg);
            border: 1px dashed var(--color-border);
          }
        `}</style>
      </div>
    );
  }

  // Dimensions
  const width = 500;
  const height = 240;
  const paddingX = 45;
  const paddingY = 30;

  // Find min/max values to scale SVG coordinates
  const prices = predictions.map((p) => p.predicted_price);
  
  // Calculate confidence limits for error bands
  const bandPoints = predictions.map((p) => {
    // Error margin is inversely proportional to confidence: e.g. (1 - confidence) * 15%
    const margin = (1.0 - p.confidence) * p.predicted_price * 0.15;
    return {
      high: p.predicted_price + margin,
      low: p.predicted_price - margin,
    };
  });

  const allYValues = [
    ...prices,
    ...bandPoints.map((b) => b.high),
    ...bandPoints.map((b) => b.low),
  ];

  const maxPrice = Math.max(...allYValues) * 1.05; // 5% padding top
  const minPrice = Math.max(0, Math.min(...allYValues) * 0.95); // 5% padding bottom

  const priceRange = maxPrice - minPrice || 1;

  // Map to SVG coordinates
  const getCoordinates = (index: number, price: number) => {
    const x = paddingX + (index / (predictions.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((price - minPrice) / priceRange) * (height - 2 * paddingY);
    return { x, y };
  };

  // Generate paths
  const linePoints = predictions.map((p, i) => getCoordinates(i, p.predicted_price));
  const linePath = linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Shaded confidence band (polygons)
  const upperPoints = predictions.map((p, i) => {
    const margin = (1.0 - p.confidence) * p.predicted_price * 0.15;
    return getCoordinates(i, p.predicted_price + margin);
  });
  
  const lowerPoints = predictions.map((p, i) => {
    const margin = (1.0 - p.confidence) * p.predicted_price * 0.15;
    return getCoordinates(i, p.predicted_price - margin);
  });

  // Connect upper from left-to-right, then lower from right-to-left
  const bandPath = [
    ...upperPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`),
    ...[...lowerPoints].reverse().map((p) => `L ${p.x} ${p.y}`),
    "Z"
  ].join(" ");

  // Y-axis tick values (3 levels)
  const yTicks = [
    minPrice + priceRange * 0.1,
    minPrice + priceRange * 0.5,
    minPrice + priceRange * 0.9,
  ];

  return (
    <div className="prediction-chart card">
      <div className="chart-header">
        <div>
          <span className="badge badge-success">Prediksi Tren Harga</span>
          <h3 style={{ fontSize: "var(--text-base)", marginTop: "var(--space-1)" }}>
            Proyeksi 14 Hari ke Depan: {commodityName.replace("_", " ").toUpperCase()}
          </h3>
        </div>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-line" />
            <span>Prediksi</span>
          </div>
          <div className="legend-item">
            <span className="legend-band" />
            <span>Rentang Keyakinan AI</span>
          </div>
        </div>
      </div>

      <div className="svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = height - paddingY - ((tick - minPrice) / priceRange) * (height - 2 * paddingY);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="9px"
                  fill="var(--color-text-muted)"
                  fontWeight="500"
                >
                  {formatCurrency(tick).replace("Rp", "").trim()}
                </text>
              </g>
            );
          })}

          {/* Shaded Confidence Band */}
          <path
            d={bandPath}
            fill="var(--color-primary-bg)"
            opacity="0.6"
            stroke="transparent"
          />

          {/* Core Prediction Line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interaction Dots */}
          {linePoints.map((p, i) => {
            const pred = predictions[i];
            const isHovered = hoveredPoint && hoveredPoint.index === i;
            
            return (
              <g key={i}>
                {/* Bigger invisible trigger circle for touch compatibility */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="14"
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredPoint({ ...pred, ...p, index: i })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                
                {/* Visible dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? "6" : "4"}
                  fill={isHovered ? "var(--color-primary-dark)" : "var(--color-primary)"}
                  stroke="white"
                  strokeWidth="2"
                  style={{ transition: "r var(--transition-fast)" }}
                />
              </g>
            );
          })}

          {/* X Axis Labels (first, middle, last dates) */}
          {[0, Math.floor(predictions.length / 2), predictions.length - 1].map((index) => {
            const p = linePoints[index];
            const pred = predictions[index];
            if (!p || !pred) return null;
            
            return (
              <text
                key={index}
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="9px"
                fill="var(--color-text-muted)"
                fontWeight="500"
              >
                {formatDate(pred.predicted_for).split(",")[0]}
              </text>
            );
          })}
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100 - 32}%`,
            }}
          >
            <div className="tooltip-date">
              {new Date(hoveredPoint.predicted_for).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </div>
            <div className="tooltip-price">
              {formatCurrency(hoveredPoint.predicted_price)}
            </div>
            <div className="tooltip-confidence">
              Keyakinan: {Math.round(hoveredPoint.confidence * 100)}%
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .prediction-chart {
          position: relative;
        }

        .chart-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .legend {
          display: flex;
          gap: var(--space-4);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-line {
          width: 16px;
          height: 3px;
          background: var(--color-primary);
          border-radius: var(--radius-full);
          display: inline-block;
        }

        .legend-band {
          width: 16px;
          height: 10px;
          background: var(--color-primary-bg);
          border-radius: 2px;
          opacity: 0.8;
          display: inline-block;
        }

        .svg-container {
          position: relative;
          width: 100%;
        }

        .chart-tooltip {
          position: absolute;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          box-shadow: var(--shadow-md);
          font-size: 11px;
          transform: translate(-50%, -100%);
          pointer-events: none;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 120px;
        }

        .chart-tooltip::after {
          content: "";
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 8px;
          height: 8px;
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
        }

        .tooltip-date {
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .tooltip-price {
          font-weight: 700;
          color: var(--color-primary-dark);
        }

        .tooltip-confidence {
          font-size: 10px;
          color: var(--color-primary-mid);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
