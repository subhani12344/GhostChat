"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Ban, 
  Unlock, 
  LogOut, 
  AlertOctagon, 
  Mail, 
  Trash2, 
  User, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX
} from "lucide-react";

interface PlatformUser {
  id: string | number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  suspended_until: string | null;
  lifetime_reports: number;
}

interface UserManagementProps {
  token: string;
}

export default function UserManagement({ token }: UserManagementProps) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || (typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1") ? "https://ghostchat-backend.onrender.com" : "http://localhost:4000");

  // Modal states
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showActionModal, setShowActionModal] = useState<"suspend" | "ban" | "warn" | "notify" | "delete" | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [suspendDays, setSuspendDays] = useState(20);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `${serverUrl}/api/admin/platform/users?search=${encodeURIComponent(search)}&status=${statusFilter}&offset=${offset}&limit=${limit}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch platform users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, statusFilter, offset]);

  const handleUserAction = async (action: string, bodyPayload: any) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const username = selectedUser.username;
      const res = await fetch(`${serverUrl}/api/admin/platform/users/${username}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload)
      });
      if (res.ok) {
        alert(`Action completed successfully!`);
        setShowActionModal(null);
        setActionInput("");
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.message || "Failed to perform action"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to signaling server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUserDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const username = selectedUser.username;
      const res = await fetch(`${serverUrl}/api/admin/platform/users/${username}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert(`User deleted permanently.`);
        setShowActionModal(null);
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.message || "Deletion failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to signaling server.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async (user: PlatformUser) => {
    try {
      const res = await fetch(`${serverUrl}/api/admin/platform/users/${user.username}/unban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("User unbanned successfully.");
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnsuspend = async (user: PlatformUser) => {
    try {
      const res = await fetch(`${serverUrl}/api/admin/platform/users/${user.username}/unsuspend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("User unsuspended successfully.");
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceLogout = async (user: PlatformUser) => {
    if (!confirm(`Force logout all active sessions for ${user.username}?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/platform/users/${user.username}/force-logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("Force logout signal sent.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isSuspended = (user: PlatformUser) => {
    return user.suspended_until && new Date(user.suspended_until) > new Date();
  };

  return (
    <div className="space-y-6 text-white p-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10 glass-dark">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="Search users by name, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-white/40" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
          >
            <option value="all" className="bg-neutral-900 text-white">All Statuses</option>
            <option value="active" className="bg-neutral-900 text-white">Active Only</option>
            <option value="suspended" className="bg-neutral-900 text-white">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden glass-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/5">
                <th className="py-4 px-6">User Details</th>
                <th className="py-4 px-6">Registration Date</th>
                <th className="py-4 px-6">Lifetime Reports</th>
                <th className="py-4 px-6">Account Status</th>
                <th className="py-4 px-6 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
                    <span className="text-white/40 mt-2 block">Loading users database...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-white/40">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const suspended = isSuspended(user);
                  return (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${
                            user.username.startsWith("Guest") 
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          }`}>
                            {user.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{user.username}</div>
                            <div className="text-xs text-white/40">{user.email || "No Email (Anonymous)"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-white/60">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-sm text-white/60">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.lifetime_reports > 0 ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/40"
                        }`}>
                          {user.lifetime_reports || 0} Reports
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {suspended ? (
                          <span className="flex items-center space-x-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full w-max">
                            <UserX className="w-3.5 h-3.5" />
                            <span>Suspended</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full w-max">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => { setSelectedUser(user); setShowProfile(true); }}
                            className="bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded text-xs transition-colors"
                          >
                            Profile
                          </button>
                          
                          <button
                            onClick={() => handleForceLogout(user)}
                            title="Force Logout Session"
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-amber-400 hover:text-amber-300"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>

                          {suspended ? (
                            <button
                              onClick={() => handleUnsuspend(user)}
                              title="Unsuspend User"
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded text-emerald-400"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSelectedUser(user); setShowActionModal("suspend"); }}
                              title="Suspend User"
                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded text-amber-400"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => { setSelectedUser(user); setShowActionModal("ban"); }}
                            title="Ban Globally"
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <AlertOctagon className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => { setSelectedUser(user); setShowActionModal("warn"); }}
                            title="Send Warning Alert"
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded text-blue-400"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => { setSelectedUser(user); setShowActionModal("delete"); }}
                            title="Purge / Delete User"
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded text-rose-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/5 text-sm text-white/60">
          <div>
            Showing <span className="text-white font-semibold">{offset + 1}</span> - <span className="text-white font-semibold">{offset + users.length}</span> users
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="p-2 border border-white/10 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={users.length < limit}
              className="p-2 border border-white/10 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {showProfile && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 w-full max-w-md glass-dark text-white space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <User className="w-5 h-5 text-rose-500" />
                <span>User Audit Profile</span>
              </h3>
              <button onClick={() => setShowProfile(false)} className="text-white/40 hover:text-white">&times;</button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center font-bold text-xl text-rose-300">
                  {selectedUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedUser.username}</h2>
                  <span className="text-xs text-white/50">{selectedUser.email || "No Email (Guest Session)"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm border-t border-white/5 pt-4">
                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase font-semibold">User Role</div>
                  <div className="font-semibold capitalize">{selectedUser.role}</div>
                </div>
                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase font-semibold">Reports Stack</div>
                  <div className="font-semibold text-rose-400">{selectedUser.lifetime_reports || 0} Total</div>
                </div>
                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase font-semibold">Created At</div>
                  <div className="text-xs">{new Date(selectedUser.created_at).toLocaleString()}</div>
                </div>
                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase font-semibold">Suspension Expiry</div>
                  <div className="text-xs truncate">{selectedUser.suspended_until ? new Date(selectedUser.suspended_until).toLocaleDateString() : "Not suspended"}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setShowProfile(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals (Suspend/Ban/Warn/Notify/Delete) */}
      {showActionModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 w-full max-w-md glass-dark text-white space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-md font-bold capitalize">
                {showActionModal} {selectedUser.username}
              </h3>
              <button onClick={() => { setShowActionModal(null); setActionInput(""); }} className="text-white/40 hover:text-white">&times;</button>
            </div>

            <div className="space-y-4">
              {showActionModal === "suspend" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/60">Suspension Length (Days)</label>
                  <input
                    type="number"
                    value={suspendDays}
                    onChange={(e) => setSuspendDays(parseInt(e.target.value) || 20)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-rose-500 text-white"
                  />
                </div>
              )}

              {showActionModal !== "delete" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/60">
                    {showActionModal === "warn" || showActionModal === "notify" ? "Message Text" : "Reason for action"}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={`Enter details here...`}
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-rose-500 text-white"
                  />
                </div>
              )}

              {showActionModal === "delete" && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-xs text-rose-300">
                  ⚠️ <strong>Irreversible Action!</strong> This will completely purge all profile details, follow graphs, chats, and records associated with <strong>{selectedUser.username}</strong> from the database.
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => { setShowActionModal(null); setActionInput(""); }}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                disabled={actionLoading}
                onClick={() => {
                  if (showActionModal === "suspend") {
                    handleUserAction("suspend", { durationDays: suspendDays, reason: actionInput });
                  } else if (showActionModal === "ban") {
                    handleUserAction("ban", { reason: actionInput });
                  } else if (showActionModal === "warn") {
                    handleUserAction("warn", { message: actionInput });
                  } else if (showActionModal === "notify") {
                    handleUserAction("notify", { message: actionInput });
                  } else if (showActionModal === "delete") {
                    handleUserDelete();
                  }
                }}
                className={`px-4 py-2 rounded text-sm font-semibold flex items-center space-x-2 cursor-pointer ${
                  showActionModal === "delete" || showActionModal === "ban" 
                    ? "bg-rose-600 hover:bg-rose-500" 
                    : "bg-rose-500 hover:bg-rose-400"
                }`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm Action</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
