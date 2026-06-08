"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sprout,
  LayoutDashboard,
  Package,
  MessageSquare,
  User,
  Truck,
  MapPin,
  ScanLine,
  Shield,
  Users,
  Activity,
  LogOut,
  Menu,
  X,
  ChevronRight,
  FileText,
  Inbox,
} from "lucide-react";
import { getToken, getStoredUser, removeToken } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  farmer: [
    { label: "Dashboard", href: "/farmer", icon: <LayoutDashboard size={20} /> },
    { label: "Batch Produk", href: "/farmer/batches", icon: <Package size={20} /> },
    { label: "Cari Distributor", href: "/farmer/matching", icon: <Users size={20} /> },
    { label: "Laporan Mingguan", href: "/farmer/reports", icon: <FileText size={20} /> },
    { label: "Chat AI", href: "/farmer/chat", icon: <MessageSquare size={20} /> },
    { label: "Profil", href: "/farmer/profile", icon: <User size={20} /> },
  ],
  distributor: [
    { label: "Dashboard", href: "/distributor", icon: <LayoutDashboard size={20} /> },
    { label: "Permintaan", href: "/distributor/requests", icon: <Inbox size={20} /> },
    { label: "Rute", href: "/distributor/route-planner", icon: <MapPin size={20} /> },
    { label: "Tracking", href: "/distributor/tracking", icon: <ScanLine size={20} /> },
    { label: "Profil", href: "/distributor/profile", icon: <User size={20} /> },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: <LayoutDashboard size={20} /> },
    { label: "Users", href: "/admin/users", icon: <Users size={20} /> },
    { label: "Agent Logs", href: "/admin/agent-logs", icon: <Activity size={20} /> },
    { label: "Profil", href: "/admin/profile", icon: <User size={20} /> },
  ],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.push("/login");
      return;
    }
    setUser(stored);
  }, [router]);

  function handleLogout() {
    setShowLogoutConfirm(true);
  }

  function confirmLogout() {
    removeToken();
    router.push("/login");
  }

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || [];
  const roleLabel = user.role === "farmer" ? "Petani" : user.role === "distributor" ? "Distributor" : "Admin";

  // Role-based avatar background colors (harmonious palette)
  const avatarBgColor = user.role === "admin" ? "2D6A4F" : user.role === "farmer" ? "40916C" : "1B4332";
  const avatarFontColor = "ffffff";
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${avatarBgColor}&color=${avatarFontColor}&size=128&bold=true&rounded=true&format=png`;

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo">
            <img src="/images/logo-with-text.png" alt="Yawgriva Logo" className="sidebar-logo-img" />
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span className="sidebar-link-text">{item.label}</span>
                <span className="sidebar-link-arrow">
                  <ChevronRight size={16} />
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              <img src={avatarUrl} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">{roleLabel}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        {/* Top bar (mobile) */}
        <header className="dashboard-topbar">
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="topbar-title">
            {navItems.find((i) => i.href === pathname)?.label || "Dashboard"}
          </span>
          <div className="topbar-avatar">
            <img src={avatarUrl} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          </div>
        </header>

        {/* Content */}
        <div className={`dashboard-content ${pathname?.endsWith("/chat") ? "dashboard-content-full" : ""}`}>
          {children}
        </div>
      </main>

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
              Apakah Anda yakin ingin keluar dari dashboard?
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
