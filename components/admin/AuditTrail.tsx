"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Search, 
  Download, 
  Loader2, 
  Clock, 
  User, 
  ShieldCheck 
} from "lucide-react";

interface AuditLog {
  id: string | number;
  admin_id: string | number | null;
  admin_username: string;
  admin_role: string;
  ip_address: string;
  user_agent: string;
  device_fingerprint: string;
  action_type: string;
  target_type: string;
  target_id: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface AuditTrailProps {
  token: string;
}

export default function AuditTrail({ token }: AuditTrailProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/audit`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    // Header
    const headers = [
      "ID", "Admin Username", "Admin Role", "Action Type", 
      "Target Type", "Target ID", "IP Address", "User Agent", 
      "Created At", "Previous Value", "New Value"
    ];

    const rows = filteredLogs.map(log => [
      log.id,
      log.admin_username,
      log.admin_role,
      log.action_type,
      log.target_type,
      log.target_id,
      log.ip_address,
      log.user_agent.replace(/,/g, " "), // escape commas
      log.created_at,
      log.previous_value ? JSON.stringify(log.previous_value).replace(/"/g, '""') : "",
      log.new_value ? JSON.stringify(log.new_value).replace(/"/g, '""') : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ghostchat_admin_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `ghostchat_admin_audit_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.admin_username.toLowerCase().includes(search.toLowerCase()) ||
      log.action_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.target_id && log.target_id.toLowerCase().includes(search.toLowerCase())) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(search.toLowerCase()));
    
    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;

    return matchesSearch && matchesAction;
  });

  // Extract unique action types for filter
  const actionTypes = Array.from(new Set(logs.map(log => log.action_type)));

  return (
    <div className="space-y-6 text-white p-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10 glass-dark">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="Search audit trail by admin, action, target, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-3 gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
          >
            <option value="all" className="bg-neutral-900 text-white">All Actions</option>
            {actionTypes.map(type => (
              <option key={type} value={type} className="bg-neutral-900 text-white">{type}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-rose-500" />
            <span>CSV</span>
          </button>
          
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Audit Logs list */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden glass-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/5">
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Administrator</th>
                <th className="py-4 px-6">Action / Event</th>
                <th className="py-4 px-6">Target Location</th>
                <th className="py-4 px-6 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
                    <span className="text-white/40 mt-2 block">Syncing immutable logs...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-white/40">
                    No matching audit records.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-xs">
                      <td className="py-4 px-6 text-white/50">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <User className="w-3.5 h-3.5 text-rose-500" />
                          <span className="font-bold text-white/80">{log.admin_username}</span>
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-medium capitalize">
                            {log.admin_role.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1.5 font-semibold text-rose-300">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{log.action_type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-white/60">
                        {log.target_type && (
                          <span className="capitalize">{log.target_type}</span>
                        )}
                        {log.target_id && (
                          <span className="text-white/40 ml-1">({log.target_id})</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-white/50">
                        {log.ip_address}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
