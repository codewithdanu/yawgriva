"use client";

import React, { useState, useEffect } from "react";
import styles from "./MockupPriceCard.module.css";

export default function MockupPriceCard() {
  const [prices, setPrices] = useState([
    {
      commodity: "🍅 Tomat",
      key: "tomat",
      market: "Pasar Induk Kramat Jati",
      price: "Rp 4.200/kg",
      badge: "Tahan 2 hari",
      badgeClass: "hold"
    },
    {
      commodity: "🌶️ Cabai Merah",
      key: "cabai_merah",
      market: "Pasar Induk Cibitung",
      price: "Rp 28.500/kg",
      badge: "Jual Sekarang",
      badgeClass: "sell"
    },
    {
      commodity: "🥬 Kangkung",
      key: "kangkung",
      market: "Pasar Induk Bekasi",
      price: "Rp 2.800/kg",
      badge: "Tahan 1 hari",
      badgeClass: "hold"
    }
  ]);
  const [updatedTime, setUpdatedTime] = useState("Diperbarui 5 menit lalu");

  useEffect(() => {
    const API_BASE = typeof window !== "undefined"
      ? (window.location.hostname === "localhost" ? "http://localhost:8000" : "")
      : "";
      
    if (!API_BASE) return;
    
    async function fetchLivePrices() {
      try {
        let latestTimestamp: Date | null = null;
        
        const updated = await Promise.all(
          prices.map(async (item) => {
            try {
              const res = await fetch(`${API_BASE}/api/v1/prices/${item.key}`);
              if (!res.ok) return item;
              const data = await res.json();
              if (data && data.length > 0) {
                const latest = data[0]; 
                
                const recDate = new Date(latest.recorded_at);
                if (!latestTimestamp || recDate > latestTimestamp) {
                  latestTimestamp = recDate;
                }

                const formattedPrice = new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0
                }).format(latest.price_per_kg) + "/kg";
                
                let badgeText = item.badge;
                let badgeClass = item.badgeClass;
                
                if (item.key === "cabai_merah") {
                  badgeText = latest.price_per_kg > 30000 ? "Jual Sekarang" : "Tahan Dulu";
                  badgeClass = latest.price_per_kg > 30000 ? "sell" : "hold";
                }
                
                return {
                  ...item,
                  market: latest.market_name || item.market,
                  price: formattedPrice,
                  badge: badgeText,
                  badgeClass: badgeClass
                };
              }
            } catch (e) {
              // Ignore single item fetch failure
            }
            return item;
          })
        );
        
        setPrices(updated);
        
        if (latestTimestamp) {
          const diffMs = new Date().getTime() - (latestTimestamp as Date).getTime();
          const diffMins = Math.floor(diffMs / (1000 * 60));
          const diffHours = Math.floor(diffMins / 60);
          
          if (diffMins < 1) {
            setUpdatedTime("Baru saja diperbarui");
          } else if (diffMins < 60) {
            setUpdatedTime(`Diperbarui ${diffMins} menit lalu`);
          } else if (diffHours < 24) {
            setUpdatedTime(`Diperbarui ${diffHours} jam lalu`);
          } else {
            setUpdatedTime(`Diperbarui ${Math.floor(diffHours / 24)} hari lalu`);
          }
        }
      } catch (err) {
        // Fallback to static mock data
      }
    }
    
    fetchLivePrices();
  }, []);

  return (
    <div className={styles.mockupCard}>
      <div className={styles.mockupHeader}>
        <div className={`${styles.mockupDot} ${styles.red}`} />
        <div className={`${styles.mockupDot} ${styles.yellow}`} />
        <div className={`${styles.mockupDot} ${styles.green}`} />
        <span className={styles.mockupTitle}>Rekomendasi Hari Ini</span>
      </div>
      <div className={styles.mockupBody}>
        {prices.map((item, idx) => (
          <div className={styles.mockupItem} key={idx}>
            <div className={styles.mockupItemLeft}>
              <span className={styles.mockupCommodity}>{item.commodity}</span>
              <span className={styles.mockupMarket}>{item.market}</span>
            </div>
            <div className={styles.mockupItemRight}>
              <span className={styles.mockupPrice}>{item.price}</span>
              <span className={`${styles.mockupBadge} ${item.badgeClass === "sell" ? styles.sell : styles.hold}`}>
                {item.badge}
              </span>
            </div>
          </div>
        ))}
        <div className={styles.mockupFooter}>
          <span className={styles.mockupUpdated}>⟳ {updatedTime}</span>
          <span className={styles.mockupSource}>Sumber: Panel Harga Kementan</span>
        </div>
      </div>
    </div>
  );
}
