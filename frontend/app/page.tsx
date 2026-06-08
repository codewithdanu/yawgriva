"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isAuthenticated, getStoredUser, removeToken, getDashboardPath } from "@/lib/auth";
import {
  Sprout,
  BarChart3,
  Truck,
  ScanLine,
  Zap,
  ArrowRight,
  Leaf,
  ChartLine,
  Bell,
  Route,
  MapPin,
  Database,
  CloudSun,
  CheckCircle2,
  Users,
  Quote,
} from "lucide-react";
import MockupPriceCard from "@/components/landing/MockupPriceCard";
import styles from "./page.module.css";

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    setUser(getStoredUser());
  }, []);

  const handleLandingLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    removeToken();
    setIsLoggedIn(false);
    setUser(null);
    setShowLogoutConfirm(false);
    setShowProfileDropdown(false);
  };

  return (
    <div className={styles.landing}>
      {/* Navigation */}
      <nav className={styles.landingNav}>
        <div className={`container ${styles.navInner}`}>
          <Link href="/" className={styles.logo}>
            <img src="/images/logo-with-text.png" alt="Yawgriva Logo" style={{ height: "36px", objectFit: "contain" }} />
          </Link>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Fitur</a>
            <a href="#how" className={styles.navLink}>Cara Kerja</a>
            <a href="#untuk-petani" className={`${styles.navLink} ${styles.navLinkHighlight}`}>Untuk Petani</a>
          </div>
          <div className={styles.navActions}>
            {isLoggedIn && user ? (
              <div className={styles.profileDropdownWrapper}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "40px", padding: "0 16px" }}
                >
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${user.role === "admin" ? "2D6A4F" : user.role === "farmer" ? "40916C" : "1B4332"}&color=ffffff&size=40&bold=true&rounded=true&format=png`}
                    alt={user.name}
                    style={{ width: "20px", height: "20px", borderRadius: "50%" }}
                  />
                  <span>{user.name}</span>
                </button>
                {showProfileDropdown && (
                  <div className={styles.profileDropdown}>
                    <Link
                      href={getDashboardPath(user.role)}
                      className={styles.dropdownItem}
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={handleLandingLogout}
                      className={styles.dropdownItem}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background: "none",
                        color: "var(--color-danger)",
                        cursor: "pointer",
                      }}
                    >
                      Keluar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">
                  Masuk
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Mulai Gratis
                </Link>
              </>
            )}
          </div>
          <button className={styles.navMobileMenu} aria-label="Menu">
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBgGradient} />
        <div className="container">
          <div className={styles.heroGrid}>
            {/* Left: Text */}
            <div className={`${styles.heroContent} animate-fade-in`}>
              <div className={styles.heroBadge}>
                <Leaf size={14} />
                <span>Platform Hortikultura Berbasis AI</span>
              </div>
              <h1 className={styles.heroTitle}>
                Tahu Kapan Jual.
                <br />
                <span className={styles.heroHighlight}>Tahu Harga Terbaik.</span>
                <br />
                Tahu Produkmu Aman.
              </h1>
              <p className={styles.heroSubtitle}>
                Hari ini harga cabai di pasar mana? Rute mana yang produkmu paling segar sampai?
                Yawgriva menjawab itu — otomatis, setiap hari, dalam bahasa yang kamu mengerti.
              </p>
              <div className={styles.heroActions}>
                <Link href="/register?role=farmer" className="btn btn-primary btn-lg" id="cta-petani">
                  Daftar sebagai Petani
                  <ArrowRight size={18} />
                </Link>
                <Link href="/register?role=distributor" className="btn btn-secondary btn-lg" id="cta-distributor">
                  Daftar sebagai Distributor
                </Link>
              </div>
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNumber}>10+</span>
                  <span className={styles.heroStatLabel}>Komoditas hortikultura</span>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNumber}>5</span>
                  <span className={styles.heroStatLabel}>Pasar induk dipantau harian</span>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNumber}>&lt;30 dtk</span>
                  <span className={styles.heroStatLabel}>Waktu scan QR konsumen</span>
                </div>
              </div>
            </div>
            {/* Right: Dashboard Mockup */}
            <div className={`${styles.heroVisual} animate-fade-in`} style={{ animationDelay: "0.15s" }}>
              <div className={styles.heroVisualGlow} />
              <MockupPriceCard />
              <div className={styles.heroVisualBadge}>
                <CheckCircle2 size={14} />
                <span>Data diperbarui setiap hari</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Data Source Section */}
      <section className={styles.trustSection}>
        <div className="container">
          <p className={styles.trustLabel}>Dibangun dengan data resmi dari</p>
          <div className={styles.trustLogos}>
            <div className={styles.trustLogoItem}>
              <Database size={18} />
              <span>Panel Harga Kementan</span>
            </div>
            <div className={styles.trustLogoDivider} />
            <div className={styles.trustLogoItem}>
              <MapPin size={18} />
              <span>Info Pangan Jakarta</span>
            </div>
            <div className={styles.trustLogoDivider} />
            <div className={styles.trustLogoItem}>
              <CloudSun size={18} />
              <span>BMKG Open API</span>
            </div>
            <div className={styles.trustLogoDivider} />
            <div className={styles.trustLogoItem}>
              <Route size={18} />
              <span>Google Maps Platform</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.featuresSection}>
        <div className="container">
          <div className={`${styles.sectionHeader} animate-fade-in`}>
            <div className={styles.sectionBadge}>Tiga Fitur Utama</div>
            <h2>Satu Platform, Tiga Jawaban untuk Masalahmu</h2>
            <p>
              Dirancang untuk menjawab masalah nyata yang dihadapi petani dan distributor hortikultura Indonesia setiap hari.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={`${styles.featureCard} animate-fade-in`} style={{ animationDelay: "0.1s" }}>
              <div className={`${styles.featureIcon} ${styles.featureIconPrimary}`}>
                <ChartLine size={24} strokeWidth={1.5} />
              </div>
              <h3>Tahu Harga Terbaik Sebelum Jual</h3>
              <p>
                Cek harga dari 5 pasar induk setiap hari. Dapat rekomendasi: jual hari ini atau tunggu 3 hari lagi untuk margin lebih baik.
              </p>
              <ul className={styles.featureList}>
                <li>Prediksi harga 7–14 hari ke depan</li>
                <li>Data dari 5 pasar induk terbesar</li>
                <li>Rekomendasi waktu jual terbaik</li>
              </ul>
            </div>

            <div className={`${styles.featureCard} animate-fade-in`} style={{ animationDelay: "0.2s" }}>
              <div className={`${styles.featureIcon} ${styles.featureIconWarning}`}>
                <Truck size={24} strokeWidth={1.5} />
              </div>
              <h3>Rute Tercepat, Produk Paling Segar</h3>
              <p>
                Bukan rute terpendek — rute yang memastikan kangkungmu sampai dalam kondisi layak jual, bukan layu di tengah jalan.
              </p>
              <ul className={styles.featureList}>
                <li>Rekomendasi rute berbasis kesegaran</li>
                <li>Estimasi kondisi produk saat tiba</li>
                <li>Integrasi Google Maps real-time</li>
              </ul>
            </div>

            <div className={`${styles.featureCard} animate-fade-in`} style={{ animationDelay: "0.3s" }}>
              <div className={`${styles.featureIcon} ${styles.featureIconDanger}`}>
                <Bell size={24} strokeWidth={1.5} />
              </div>
              <h3>Tahu Sebelum Produkmu Bermasalah</h3>
              <p>
                Kalau batch produkmu terlambat di checkpoint, kamu dapat notifikasi langsung — tanpa harus telepon satu per satu.
              </p>
              <ul className={styles.featureList}>
                <li>Pemindaian otomatis setiap 30 menit</li>
                <li>Alert real-time ke HP kamu</li>
                <li>Rekap harian kondisi seluruh batch</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className={styles.howSection}>
        <div className="container">
          <div className={`${styles.sectionHeader} animate-fade-in`}>
            <div className={styles.sectionBadge}>Cara Kerja</div>
            <h2>Bagaimana Yawgriva Bekerja</h2>
            <p>Dari kebun ke meja makan, setiap langkah tercatat dan terlacak</p>
          </div>

          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumberBg}>01</div>
              <div className={styles.stepIcon}>
                <Sprout size={22} />
              </div>
              <h4>Petani Registrasi Batch</h4>
              <p>Catat komoditas, jumlah, dan tanggal panen. QR Code unik langsung di-generate dalam hitungan detik.</p>
            </div>
            <div className={styles.stepConnector} />
            <div className={`${styles.stepCard} animate-fade-in`} style={{ animationDelay: "0.1s" }}>
              <div className={styles.stepNumberBg}>02</div>
              <div className={styles.stepIcon}>
                <BarChart3 size={22} />
              </div>
              <h4>AI Analisis Harga & Rute</h4>
              <p>Price Agent memberikan rekomendasi kapan dan di mana menjual. Logistics Agent memilih rute terbaik.</p>
            </div>
            <div className={styles.stepConnector} />
            <div className={`${styles.stepCard} animate-fade-in`} style={{ animationDelay: "0.2s" }}>
              <div className={styles.stepNumberBg}>03</div>
              <div className={styles.stepIcon}>
                <MapPin size={22} />
              </div>
              <h4>Distribusi Terlacak</h4>
              <p>Setiap checkpoint di-scan. Anomaly Agent langsung notifikasi kalau ada keterlambatan atau masalah.</p>
            </div>
            <div className={styles.stepConnector} />
            <div className={`${styles.stepCard} animate-fade-in`} style={{ animationDelay: "0.3s" }}>
              <div className={styles.stepNumberBg}>04</div>
              <div className={styles.stepIcon}>
                <ScanLine size={22} />
              </div>
              <h4>Konsumen Scan QR</h4>
              <p>Scan QR, lihat perjalanan produk dari kebun dalam 30 detik. Transparansi penuh untuk kepercayaan lebih.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial / Use Case Section */}
      <section id="untuk-petani" className={styles.testimonialSection}>
        <div className="container">
          <div className={styles.testimonialGrid}>
            <div className={styles.testimonialCard}>
              <div className={styles.testimonialQuoteIcon}>
                <Quote size={32} />
              </div>
              <blockquote>
                &ldquo;Sebelum pakai Yawgriva, aku jual tomat Rp 2.000/kg ke tengkulak karena tidak tahu harga pasar. Sekarang bisa pilih waktu dan pembeli sendiri.&rdquo;
              </blockquote>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>
                  <img src="https://ui-avatars.com/api/?name=Pak+Budi&background=52796F&color=ffffff&size=80&bold=true&rounded=true&format=png" alt="Pak Budi" />
                </div>
                <div>
                  <div className={styles.testimonialName}>Pak Budi</div>
                  <div className={styles.testimonialNote}>Petani Tomat, Boyolali</div>
                </div>
              </div>
            </div>
            <div className={`${styles.testimonialCard} animate-fade-in`} style={{ animationDelay: "0.15s" }}>
              <div className={styles.testimonialQuoteIcon}>
                <Quote size={32} />
              </div>
              <blockquote>
                &ldquo;Dengan Yawgriva, tim distribusi saya tahu rute mana yang bikin produk paling segar sampai. Komplain dari toko turun signifikan.&rdquo;
              </blockquote>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>
                  <img src="https://ui-avatars.com/api/?name=Pak+Hendra&background=354F52&color=ffffff&size=80&bold=true&rounded=true&format=png" alt="Pak Hendra" />
                </div>
                <div>
                  <div className={styles.testimonialName}>Pak Hendra</div>
                  <div className={styles.testimonialNote}>Distributor Sayuran, Depok</div>
                </div>
              </div>
            </div>
            <div className={`${styles.testimonialStats} animate-fade-in`} style={{ animationDelay: "0.25s" }}>
              <div className={styles.statsHeader}>
                <div className={styles.statsIconTitle}>
                  <BarChart3 size={18} />
                  <span>Dampak Nyata</span>
                </div>
              </div>
              <div className={styles.statsList}>
                <div className={styles.tStat}>
                  <div className={`${styles.tStatIconWrapper} ${styles.marginUp}`}>
                    <ChartLine size={20} />
                  </div>
                  <div className={styles.tStatInfo}>
                    <div className={styles.tStatNumber}>+23%</div>
                    <div className={styles.tStatLabel}>Rata-rata peningkatan margin petani</div>
                  </div>
                </div>
                <div className={styles.tStat}>
                  <div className={`${styles.tStatIconWrapper} ${styles.wasteDown}`}>
                    <Truck size={20} />
                  </div>
                  <div className={styles.tStatInfo}>
                    <div className={styles.tStatNumber}>-18%</div>
                    <div className={styles.tStatLabel}>Penurunan food waste distribusi</div>
                  </div>
                </div>
                <div className={styles.tStat}>
                  <div className={`${styles.tStatIconWrapper} ${styles.speedUp}`}>
                    <Zap size={20} />
                  </div>
                  <div className={styles.tStatInfo}>
                    <div className={styles.tStatNumber}>3 menit</div>
                    <div className={styles.tStatLabel}>Rata-rata waktu registrasi batch pertama</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={`${styles.ctaCard} animate-fade-in`}>
            <div className={styles.ctaIcon}>
              <Zap size={28} />
            </div>
            <h2>Siap Mulai Hari Ini?</h2>
            <p>
              Bergabunglah dengan ekosistem hortikultura cerdas pertama di Indonesia.
            </p>
            <p className={styles.ctaSubtext}>Gratis untuk petani. Tidak perlu kartu kredit. Mulai dalam 5 menit.</p>
            <div className={styles.ctaActions}>
              <Link href="/register?role=farmer" className="btn btn-primary btn-lg" id="cta-petani-bottom">
                <Users size={18} />
                Saya Petani — Daftar Gratis
              </Link>
              <Link href="/register?role=distributor" className="btn btn-secondary btn-lg" id="cta-distributor-bottom">
                Saya Distributor
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.landingFooter}>
        <div className="container">
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <img src="/images/logo-with-text.png" alt="Yawgriva Logo" style={{ height: "28px", objectFit: "contain" }} />
              </div>
              <p className={styles.footerTagline}>Platform AI pertama untuk rantai pasok hortikultura Indonesia.</p>
              <p className={styles.footerSub}>From Farm Data to Farm Decisions</p>
              <p className={styles.footerCredit}>© 2026 Tim Yawgriva — Universitas Primakara</p>
            </div>
            <div className={styles.footerLinks}>
              <div className={styles.footerCol}>
                <h5>Platform</h5>
                <Link href="/login">Dashboard Petani</Link>
                <Link href="/login">Dashboard Distributor</Link>
                <Link href="/trace">Scan Traceability</Link>
                <Link href="/login">Admin Panel</Link>
              </div>
              <div className={styles.footerCol}>
                <h5>Sumber Data</h5>
                <a href="https://panelharga.badanpangan.go.id/" target="_blank" rel="noopener noreferrer">Panel Harga Kementan</a>
                <a href="https://infopangan.jakarta.go.id/" target="_blank" rel="noopener noreferrer">Info Pangan Jakarta</a>
                <a href="https://data.bmkg.go.id/" target="_blank" rel="noopener noreferrer">BMKG Open API</a>
                <a href="https://mapsplatform.google.com/" target="_blank" rel="noopener noreferrer">Google Maps Platform</a>
              </div>
              <div className={styles.footerCol}>
                <h5>Tentang</h5>
                <span>Tim Regex</span>
                <span>Universitas Primakara</span>
                <a href="mailto:yawgriva@primakara.ac.id">Kontak</a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>Dibangun untuk petani Indonesia 🇮🇩</span>
          </div>
        </div>
      </footer>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h3 style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-text)" }}>
              Konfirmasi Keluar
            </h3>
            <p style={{ margin: "0 0 var(--space-6) 0", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Apakah Anda yakin ingin keluar dari akun Anda?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ minHeight: "38px" }}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmLogout}
                style={{ minHeight: "38px", background: "var(--color-danger)", color: "white" }}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
