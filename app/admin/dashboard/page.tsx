"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  Ban, 
  AlertTriangle, 
  Mail, 
  Loader2, 
  Activity, 
  RefreshCw 
} from "lucide-react";
import { io } from "socket.io-client";

// Import admin subcomponents
import AdminSidebar from "@/components/admin/AdminSidebar";
import UserManagement from "@/components/admin/UserManagement";
import ReportsQueue from "@/components/admin/ReportsQueue";
import ContactInquiries from "@/components/admin/ContactInquiries";
import DeletionRequests from "@/components/admin/DeletionRequests";
import AuditTrail from "@/components/admin/AuditTrail";
import SystemHealth from "@/components/admin/SystemHealth";

interface Metrics {
  totalUsers: number;
  registeredUsers: number;
  anonymousUsers: number;
  reportsCount: number;
  activeBans: number;
  feedbacksCount: number;
  onlineCount: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [admin, setAdmin] = useState<any>(null);
  const [token, setToken] = useState("");

  // Metrics telemetry data
  const [metrics, setMetrics] = useState<Metrics>({
    totalUsers: 0,
    registeredUsers: 0,
    anonymousUsers: 0,
    reportsCount: 0,
    activeBans: 0,
    feedbacksCount: 0,
    onlineCount: 0
  });

  const [metricsLoading, setMetricsLoading] = useState(false);

  const fetchMetrics = async (accessToken: string) => {
    setMetricsLoading(true);
    try {
      const res = await fetch("/api/admin/analytics/metrics", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to load metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    const initDashboard = async () => {
      const savedToken = localStorage.getItem("admin_token");
      if (!savedToken) {
        router.push("/admin");
        return;
      }

      setToken(savedToken);

      try {
        const res = await fetch("/api/admin/auth/me", {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAdmin(data);
          setLoading(false);
          fetchMetrics(savedToken);
          setupLiveTelemetry(savedToken);
        } else {
          localStorage.removeItem("admin_token");
          router.push("/admin");
        }
      } catch (e) {
        localStorage.removeItem("admin_token");
        router.push("/admin");
      }
    };
    initDashboard();
  }, []);

  const setupLiveTelemetry = (accessToken: string) => {
    const socketUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
    const socket = io(`${socketUrl}/admin`, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"]
    });

    socket.on("user:registered", () => {
      setMetrics(prev => ({
        ...prev,
        totalUsers: prev.totalUsers + 1,
        registeredUsers: prev.registeredUsers + 1
      }));
    });

    socket.on("contact:new", () => {
      setMetrics(prev => ({ ...prev, feedbacksCount: prev.feedbacksCount + 1 }));
    });

    socket.on("report:submitted", () => {
      setMetrics(prev => ({ ...prev, reportsCount: prev.reportsCount + 1 }));
    });

    socket.on("ban:applied", () => {
      setMetrics(prev => ({ ...prev, activeBans: prev.activeBans + 1 }));
    });

    socket.on("metrics:update", (updated: any) => {
      if (updated.onlineCount !== undefined) {
        setMetrics(prev => ({ ...prev, onlineCount: updated.onlineCount }));
      }
    });

    return () => {
      socket.disconnect();
    };
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}

    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.push("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
        <span className="text-sm text-white/50 tracking-wider">Securing direct route mapping...</span>
      </div>
    );
  }

  // Render view by active selected tab
  const renderTabContent = () => {
    switch (currentTab) {
      case "users":
        return <UserManagement token={token} />;
      case "reports":
        return <ReportsQueue token={token} />;
      case "contacts":
        return <ContactInquiries token={token} />;
      case "deletions":
        return <DeletionRequests token={token} />;
      case "audit":
        return <AuditTrail token={token} />;
      case "health":
        return <SystemHealth token={token} />;
      case "dashboard":
      default:
        return renderOverviewDashboard();
    }
  };

  const renderOverviewDashboard = () => {
    const cards = [
      {
        title: "Active WebSocket Connections",
        value: metrics.onlineCount,
        icon: Activity,
        color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
        desc: "Users live matching right now"
      },
      {
        title: "Total User Registry",
        value: metrics.totalUsers,
        icon: Users,
        color: "text-rose-500 border-rose-500/20 bg-rose-500/5",
        desc: "Registered and guest logins"
      },
      {
        title: "Active Platform IP Bans",
        value: metrics.activeBans,
        icon: Ban,
        color: "text-red-400 border-red-500/20 bg-red-500/5",
        desc: "Spammers locked out"
      },
      {
        title: "Abuse Reports Registry",
        value: metrics.reportsCount,
        icon: AlertTriangle,
        color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
        desc: "Requires manual resolution"
      },
      {
        title: "Inquiries Box",
        value: metrics.feedbacksCount,
        icon: Mail,
        color: "text-blue-400 border-blue-500/20 bg-blue-500/5",
        desc: "Customer feedback inquiries"
      }
    ];

    return (
      <div className="space-y-6 p-6">
        {/* Welcome Alert */}
        <div className="glass-dark border border-white/10 p-6 rounded-2xl flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-full bg-rose-500/5 blur-3xl pointer-events-none" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Welcome back, {admin.username}</h2>
            <p className="text-xs text-white/50">Command terminal authenticated. All logs and actions are being securely registered.</p>
          </div>
          <button 
            onClick={() => fetchMetrics(token)}
            className="p-2 border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx} 
                className={`p-6 rounded-2xl border flex flex-col justify-between h-40 glass-dark transition-all duration-300 hover:scale-[1.02] ${card.color}`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs uppercase font-bold tracking-wider text-white/60">{card.title}</span>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-3xl font-extrabold text-white mt-2">
                    {metricsLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                    ) : (
                      card.value
                    )}
                  </h3>
                  <p className="text-xs text-white/40 mt-1 font-medium">{card.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black flex text-white relative font-sans overflow-hidden">
      {/* Sidebar navigation */}
      <AdminSidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        adminRole={admin.role}
        adminUsername={admin.username}
        onLogout={handleLogout}
      />

      {/* Main page details container */}
      <div className="flex-1 h-screen overflow-y-auto flex flex-col bg-neutral-950/45">
        {/* Top Control centre bar */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-neutral-950/20 shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <h1 className="text-sm font-bold tracking-wider uppercase text-white/70">Control Centre</h1>
          </div>
          <div className="text-xs text-white/40 font-medium">
            System status: <span className="text-emerald-400 font-bold">ONLINE</span>
          </div>
        </header>

        {/* Tab rendering */}
        <main className="flex-grow">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}
