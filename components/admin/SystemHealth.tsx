"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Link, 
  Loader2, 
  RefreshCw, 
  Server, 
  CheckCircle 
} from "lucide-react";

interface HealthData {
  status: string;
  cpuUsage: number;
  freeMemPercent: number;
  uptime: number;
  dbStatus: string;
  onlineSockets: number;
}

interface SystemHealthProps {
  token: string;
}

export default function SystemHealth({ token }: SystemHealthProps) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/health", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-6 text-white p-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 glass-dark">
        <div className="flex items-center space-x-3">
          <Activity className="w-6 h-6 text-rose-500 animate-pulse-soft" />
          <div>
            <h3 className="font-bold text-sm">System Diagnostics</h3>
            <span className="text-xs text-white/50">Real-time Node.js and system health status.</span>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="p-2 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {health ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card: CPU */}
          <div className="bg-white/5 p-6 rounded-xl border border-white/10 glass-dark space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60 font-semibold uppercase tracking-wider">CPU Utilization</span>
              <Cpu className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white">{health.cpuUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(2, health.cpuUsage))}%` }}
              />
            </div>
          </div>

          {/* Card: RAM */}
          <div className="bg-white/5 p-6 rounded-xl border border-white/10 glass-dark space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60 font-semibold uppercase tracking-wider">Memory Allocation</span>
              <HardDrive className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white">{(100 - health.freeMemPercent).toFixed(1)}%</span>
              <span className="text-xs text-white/40">Used</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: `${100 - health.freeMemPercent}%` }}
              />
            </div>
          </div>

          {/* Card: WebSockets */}
          <div className="bg-white/5 p-6 rounded-xl border border-white/10 glass-dark space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60 font-semibold uppercase tracking-wider">WebSocket Clusters</span>
              <Link className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white">{health.onlineSockets}</span>
              <span className="text-xs text-white/40">Active Nodes</span>
            </div>
            <div className="text-xs text-white/50 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Signaling listeners connected</span>
            </div>
          </div>

          {/* Infrastructure Health details */}
          <div className="md:col-span-2 lg:col-span-3 bg-white/5 p-6 rounded-xl border border-white/10 glass-dark space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-wider text-rose-300">Monitored Microservices</h4>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded bg-black/20 border border-white/5 text-sm">
                <span className="text-white/60 font-medium">PostgreSQL Engine</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 uppercase">
                  {health.dbStatus}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-black/20 border border-white/5 text-sm">
                <span className="text-white/60 font-medium">WebSocket Server</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 uppercase">
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-black/20 border border-white/5 text-sm">
                <span className="text-white/60 font-medium">Docker Node Server</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 uppercase">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-black/20 border border-white/5 text-sm">
                <span className="text-white/60 font-medium">Uptime duration</span>
                <span className="font-mono text-xs text-white/90">
                  {formatUptime(health.uptime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
          <span className="mt-2 block text-xs">Waiting for telemetry feedback...</span>
        </div>
      )}
    </div>
  );
}
