"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Key, User, QrCode, ArrowRight, Loader2, Settings } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";
  
  // Settings gear configurations
  const [showSettings, setShowSettings] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState("");

  // Load custom URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ghostchat_backend_url");
      if (saved) setCustomServerUrl(saved);
    }
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      if (customServerUrl.trim()) {
        localStorage.setItem("ghostchat_backend_url", customServerUrl.trim());
      } else {
        localStorage.removeItem("ghostchat_backend_url");
      }
      window.location.reload();
    }
  };

  // 2FA state variables
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [adminId, setAdminId] = useState<any>(null);
  const [otpCode, setOtpCode] = useState("");

  // 2FA Setup state variables
  const [setup2FA, setSetup2FA] = useState(false);
  const [setupSecret, setSetupSecret] = useState("");
  const [qrUri, setQrUri] = useState("");

  // Local state for checking if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const savedToken = localStorage.getItem("admin_token");
      if (savedToken) {
        try {
          const res = await fetch(`${serverUrl}/api/admin/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          if (res.ok) {
            router.push("/admin/dashboard");
          }
        } catch (e) {
          localStorage.removeItem("admin_token");
        }
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${serverUrl}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.requires2FA) {
          setRequires2FA(true);
          setTempToken(data.tempToken);
          setAdminId(data.adminId);
        } else if (data.setup2FA) {
          // Store token temporarily to authorize 2FA setup endpoints
          localStorage.setItem("admin_token", data.token);
          setAdminId(data.admin.id);
          initiate2FASetup(data.token);
        } else {
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("admin_user", JSON.stringify(data.admin));
          router.push("/admin/dashboard");
        }
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch (err) {
      setError("Failed to connect to signaling backend.");
    } finally {
      setLoading(false);
    }
  };

  const initiate2FASetup = async (accessToken: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/admin/auth/2fa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSetupSecret(data.secret);
        setQrUri(data.qrUri);
        setSetup2FA(true);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to initiate 2FA setup");
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setLoading(true);
    setError("");

    try {
      const payload: any = { code: otpCode };
      if (setup2FA) {
        payload.setupSecret = setupSecret;
        payload.adminId = adminId;
      } else {
        payload.tempToken = tempToken;
        payload.adminId = adminId;
      }

      const res = await fetch(`${serverUrl}/api/admin/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        if (setup2FA) {
          alert("2FA Setup verified successfully! Please log in again.");
          setSetup2FA(false);
          setRequires2FA(false);
          setUsername("");
          setPassword("");
          localStorage.removeItem("admin_token");
        } else {
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("admin_user", JSON.stringify(data.admin));
          router.push("/admin/dashboard");
        }
      } else {
        setError(data.message || "Invalid verification code");
      }
    } catch (err) {
      setError("Failed to verify 2FA token.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-dark rounded-2xl border border-white/10 p-8 space-y-6 text-white select-none relative z-10">
        
        {/* Settings gear trigger button */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer z-20"
          title="Server Connection Settings"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-lg">
            <Shield className="w-7 h-7 text-rose-500 animate-pulse-soft" />
          </div>
          <div className="text-center">
            <h1 className="font-extrabold text-2xl tracking-wider bg-gradient-to-r from-rose-400 to-red-600 bg-clip-text text-transparent">GHOST COMMAND</h1>
            <p className="text-xs text-white/40 tracking-widest mt-1 uppercase font-semibold">Security System Authentication</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs py-3 px-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {showSettings ? (
          /* Server Configuration Override Panel */
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2">
              <h3 className="text-xs uppercase font-bold tracking-wider text-rose-400">Server Configuration</h3>
              <p className="text-[11px] text-white/40 leading-relaxed leading-normal">
                If the portal cannot reach the backend server (due to cold-start delays or if your Render backend URL is different), customize your signaling endpoint below.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-white/50 tracking-wider">Active Server URL</label>
              <div className="text-xs font-mono bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-white/60 select-all break-all">
                {serverUrl}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-white/50 tracking-wider">Override URL</label>
              <input
                type="url"
                placeholder="https://ghostchat-backend.onrender.com"
                value={customServerUrl}
                onChange={(e) => setCustomServerUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-rose-500 text-white font-mono placeholder-white/20"
              />
              <span className="text-[10px] text-white/20 block mt-1">Leave blank to restore the default Render endpoint fallback.</span>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl text-xs font-bold transition-all cursor-pointer text-white shadow-lg shadow-rose-950/20"
              >
                Save & Apply
              </button>
            </div>
          </form>
        ) : !requires2FA && !setup2FA ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-white/50 tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  required
                  placeholder="superadmin_1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-rose-500 text-white transition-colors placeholder-white/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-white/50 tracking-wider">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-rose-500 text-white transition-colors placeholder-white/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-sm font-bold rounded-xl flex items-center justify-center space-x-2 mt-6 cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Authenticate</span> <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : setup2FA ? (
          /* 2FA Setup Flow */
          <form onSubmit={handleVerify2FA} className="space-y-5">
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-xs text-rose-300 text-center leading-relaxed">
              🔒 <strong>2FA Setup Required!</strong> Enter the secret key below in Google Authenticator or scan the QR code to proceed.
            </div>

            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white p-3 rounded-lg border border-white/10 flex items-center justify-center w-40 h-40">
                {/* QR code fallback text box */}
                <div className="text-black text-center text-xs space-y-2 font-mono break-all p-1">
                  <QrCode className="w-8 h-8 text-neutral-800 mx-auto" />
                  <span className="text-[10px] text-neutral-500 select-all block">{setupSecret}</span>
                </div>
              </div>
              <span className="text-[10px] text-white/40 uppercase font-semibold">Key: <code className="text-rose-400 select-all">{setupSecret}</code></span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-white/50 tracking-wider">Verification Code</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center text-lg font-bold tracking-[6px] focus:outline-none focus:border-rose-500 text-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-sm font-bold rounded-xl flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Confirm Secret Enrollment</span>}
            </button>
          </form>
        ) : (
          /* Standard 2FA Verification Flow */
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-xs text-rose-300 text-center leading-relaxed">
              🔑 <strong>Enter 2FA Code</strong> to authorize this secure admin session.
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-white/50 tracking-wider">Authenticator TOTP Code</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center text-lg font-bold tracking-[6px] focus:outline-none focus:border-rose-500 text-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-sm font-bold rounded-xl flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Authorize Session</span>}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
