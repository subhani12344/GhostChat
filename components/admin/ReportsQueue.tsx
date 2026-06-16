"use client";

import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  Loader2, 
  Clock, 
  ShieldAlert,
  CheckSquare,
  Square
} from "lucide-react";

interface Report {
  id: string | number;
  reporter_ip: string;
  reported_ip: string;
  reporter_username: string;
  reported_username: string;
  reason: string;
  details: string;
  created_at: string;
  status?: string; // resolved / pending
}

interface ReportsQueueProps {
  token: string;
}

export default function ReportsQueue({ token }: ReportsQueueProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedReports, setSelectedReports] = useState<(string | number)[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        // Default mock status if none returned
        const mapped = data.map((r: any) => ({
          ...r,
          status: r.status || "pending"
        }));
        setReports(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResolve = async (id: string | number) => {
    try {
      const res = await fetch(`/api/admin/reports/${id}/resolve`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setReports(prev => prev.map(r => r.id === id ? { ...r, status: "resolved" } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedReports.length === 0) return;
    setActionLoading(true);
    try {
      for (const id of selectedReports) {
        await fetch(`/api/admin/reports/${id}/resolve`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      alert(`Resolved ${selectedReports.length} reports successfully.`);
      setSelectedReports([]);
      fetchReports();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectReport = (id: string | number) => {
    setSelectedReports(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pendingIds = reports.filter(r => r.status !== "resolved").map(r => r.id);
    if (selectedReports.length === pendingIds.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(pendingIds);
    }
  };

  const filteredReports = reports.filter(r => 
    r.reported_username.toLowerCase().includes(search.toLowerCase()) ||
    r.reporter_username.toLowerCase().includes(search.toLowerCase()) ||
    r.reason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 text-white p-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10 glass-dark">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="Search reports by suspect, reporter, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        {selectedReports.length > 0 && (
          <button
            onClick={handleBulkResolve}
            disabled={actionLoading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-sm font-semibold rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            <span>Mark Selected Resolved ({selectedReports.length})</span>
          </button>
        )}
      </div>

      {/* Reports Listing */}
      <div className="grid gap-4">
        {loading ? (
          <div className="bg-white/5 rounded-xl border border-white/10 p-10 text-center glass-dark">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
            <span className="text-white/40 mt-2 block">Scanning reports database...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white/5 rounded-xl border border-white/10 p-10 text-center text-white/40 glass-dark">
            No pending reports found.
          </div>
        ) : (
          filteredReports.map((report) => {
            const isSelected = selectedReports.includes(report.id);
            const isResolved = report.status === "resolved";

            return (
              <div 
                key={report.id} 
                className={`p-5 rounded-xl border transition-all duration-200 glass-dark ${
                  isResolved 
                    ? "bg-emerald-500/5 border-emerald-500/20" 
                    : isSelected 
                      ? "bg-rose-500/5 border-rose-500/40" 
                      : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Select Checkbox (only if pending) */}
                  {!isResolved && (
                    <button 
                      onClick={() => toggleSelectReport(report.id)}
                      className="text-white/40 hover:text-white mt-1 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-rose-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  {/* Main report body */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        <h4 className="font-bold text-base text-rose-300">
                          Suspect: {report.reported_username}
                        </h4>
                        <span className="text-white/30 text-xs">|</span>
                        <span className="text-xs text-white/50">Reporter: {report.reporter_username}</span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-white/40">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 bg-white/5 p-3 rounded-lg border border-white/5 text-sm">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase font-semibold">Violation Type</div>
                        <div className="font-medium mt-0.5 text-white/90">{report.reason}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase font-semibold">Reporter IP</div>
                        <div className="font-medium mt-0.5 text-white/90 truncate">{report.reporter_ip}</div>
                      </div>
                    </div>

                    {report.details && (
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-xs text-white/70 italic">
                        &ldquo;{report.details}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div>
                        {isResolved ? (
                          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                            Resolved
                          </span>
                        ) : (
                          <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full font-semibold">
                            Pending Review
                          </span>
                        )}
                      </div>

                      {!isResolved && (
                        <button
                          onClick={() => handleResolve(report.id)}
                          className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 rounded text-xs transition-colors cursor-pointer"
                        >
                          Resolve Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
