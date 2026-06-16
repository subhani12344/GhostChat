"use client";

import React, { useState, useEffect } from "react";
import { 
  Trash2, 
  User, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  CheckCircle, 
  XCircle,
  FileCheck
} from "lucide-react";

interface DeletionRequest {
  id: string | number;
  user_id: string | number;
  username: string;
  reason: string;
  status: string; // pending, approved, rejected, deleted
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | number | null;
}

interface DeletionRequestsProps {
  token: string;
}

export default function DeletionRequests({ token }: DeletionRequestsProps) {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<DeletionRequest | null>(null);

  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/deletion-requests`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (req: DeletionRequest) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/deletion-requests/${req.id}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username: req.username })
      });
      if (res.ok) {
        alert(`Account deletion process completed. All user details purged.`);
        setConfirmDeleteUser(null);
        fetchRequests();
      } else {
        alert("Failed to execute data purging.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reqId: string | number) => {
    if (!confirm("Are you sure you want to reject this data deletion request?")) return;
    try {
      // For now just change status in DB via mock/update request
      const res = await fetch(`${serverUrl}/api/admin/deletion-requests/${reqId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "rejected" })
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 text-white p-6">
      {/* Title */}
      <div className="flex items-center space-x-3 bg-white/5 p-4 rounded-xl border border-white/10 glass-dark">
        <AlertTriangle className="w-6 h-6 text-rose-500 animate-pulse-soft" />
        <div>
          <h3 className="font-bold text-sm">GDPR Deletion & Compliance</h3>
          <span className="text-xs text-white/50">Manage right-to-be-forgotten deletion workflows.</span>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden glass-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/5">
                <th className="py-4 px-6">User / Account</th>
                <th className="py-4 px-6">Request Date</th>
                <th className="py-4 px-6">User Stated Reason</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Compliance Controls</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
                    <span className="text-white/40 mt-2 block">Scanning compliance registry...</span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-white/40">
                    No active deletion requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isPending = req.status === "pending";
                  const isDeleted = req.status === "deleted" || req.status === "approved";

                  return (
                    <tr key={req.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-white/60">
                            {req.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{req.username}</div>
                            <div className="text-xs text-white/40">ID: {req.user_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-white/60">
                        <span className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(req.requested_at).toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-white/80 max-w-xs truncate" title={req.reason}>
                        {req.reason || "No reason provided."}
                      </td>
                      <td className="py-4 px-6">
                        {isPending ? (
                          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            Pending Approval
                          </span>
                        ) : isDeleted ? (
                          <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                            Purged
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                            {req.status}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setConfirmDeleteUser(req)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Purge Data</span>
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-white/60 hover:text-white border border-white/10 transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-white/40 flex items-center justify-end space-x-1">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Action Logged</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Double confirmation Purging dialog */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-red-500/30 rounded-xl p-6 w-full max-w-md glass-dark text-white space-y-4">
            <div className="flex justify-between items-center border-b border-red-500/20 pb-3">
              <h3 className="text-lg font-bold text-red-400 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                <span>Confirm GDPR Account Wiping</span>
              </h3>
              <button onClick={() => setConfirmDeleteUser(null)} className="text-white/40 hover:text-white">&times;</button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-white/80">
                You are about to initiate an automatic purging workflow for:
              </p>
              <div className="p-3 bg-white/5 rounded border border-white/5 text-center">
                <span className="text-base font-bold text-rose-300">@{confirmDeleteUser.username}</span>
                <span className="text-xs text-white/40 block mt-0.5">Database ID: {confirmDeleteUser.user_id}</span>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-lg text-xs text-red-300 space-y-2 leading-relaxed">
                <div>⚠️ <strong>WARNING: This action is permanent and cannot be undone!</strong></div>
                <ul className="list-disc list-inside space-y-1 text-white/70">
                  <li>Deletes all user rows from PostgreSQL/JSON.</li>
                  <li>Wipes follow links and notification rows.</li>
                  <li>Purges message logs and uploaded media files.</li>
                  <li>Revokes active JWT sessions.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-white/5">
              <button
                onClick={() => setConfirmDeleteUser(null)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                disabled={actionLoading}
                onClick={() => handleApprove(confirmDeleteUser)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Execute Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
