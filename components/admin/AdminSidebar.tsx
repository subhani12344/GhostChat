"use client";

import React from "react";
import { 
  LayoutDashboard, 
  Users, 
  AlertTriangle, 
  Mail, 
  Trash2, 
  FileText, 
  Activity, 
  LogOut, 
  Shield 
} from "lucide-react";

interface AdminSidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  adminRole: string;
  adminUsername: string;
  onLogout: () => void;
}

export default function AdminSidebar({
  currentTab,
  setCurrentTab,
  adminRole,
  adminUsername,
  onLogout
}: AdminSidebarProps) {
  
  // Pre-configured tab configuration with permissions check
  const tabs = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["super_admin", "platform_admin", "moderator", "support_admin", "analytics_admin"]
    },
    {
      id: "users",
      label: "User Manager",
      icon: Users,
      roles: ["super_admin", "platform_admin", "moderator"]
    },
    {
      id: "reports",
      label: "Reports Queue",
      icon: AlertTriangle,
      roles: ["super_admin", "platform_admin", "moderator"]
    },
    {
      id: "contacts",
      label: "Support Inbox",
      icon: Mail,
      roles: ["super_admin", "platform_admin", "moderator", "support_admin"]
    },
    {
      id: "deletions",
      label: "Compliance (GDPR)",
      icon: Trash2,
      roles: ["super_admin", "platform_admin", "support_admin"]
    },
    {
      id: "audit",
      label: "Audit Trails",
      icon: FileText,
      roles: ["super_admin"]
    },
    {
      id: "health",
      label: "System Health",
      icon: LayoutDashboard, // fallback or Activity
      roles: ["super_admin", "platform_admin", "analytics_admin"]
    }
  ];

  // Helper to check if role matches requirements
  const hasAccess = (allowedRoles: string[]) => {
    return allowedRoles.includes(adminRole);
  };

  // Human readable role conversion
  const getRoleLabel = (role: string) => {
    return role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  return (
    <div className="w-64 glass-dark h-full flex flex-col justify-between border-r border-white/10 text-white select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 flex items-center space-x-3 border-b border-white/10">
          <Shield className="w-8 h-8 text-rose-500 animate-pulse-soft" />
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wider bg-gradient-to-r from-rose-400 to-red-600 bg-clip-text text-transparent">GHOST CONTROL</h1>
            <span className="text-[10px] uppercase font-semibold text-white/50 tracking-widest">Admin Command</span>
          </div>
        </div>

        {/* User profile section */}
        <div className="p-4 mx-4 my-4 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-bold text-rose-300">
            {adminUsername.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold truncate text-white/90">{adminUsername}</h4>
            <span className="text-[11px] text-rose-400 font-medium">{getRoleLabel(adminRole)}</span>
          </div>
        </div>

        {/* Tab Links */}
        <nav className="px-4 space-y-1">
          {tabs.map((tab) => {
            if (!hasAccess(tab.roles)) return null;
            const Icon = tab.id === "health" ? Activity : tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-rose-500/20 border-l-4 border-rose-500 text-rose-300" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span>Exit Session</span>
        </button>
      </div>
    </div>
  );
}
