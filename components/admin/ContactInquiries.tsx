"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Loader2, 
  Clock, 
  Tag, 
  AlertCircle,
  CheckCircle,
  Inbox
} from "lucide-react";
import { io, Socket } from "socket.io-client";

interface Reply {
  id: string | number;
  admin_id: string | number;
  reply: string;
  created_at: string;
}

interface Inquiry {
  id: string | number;
  user_id: string | number | null;
  username: string;
  category: string;
  subject: string;
  message: string;
  priority: string;
  status: string; // new, resolved
  created_at: string;
  replies?: Reply[];
}

interface ContactInquiriesProps {
  token: string;
}

export default function ContactInquiries({ token }: ContactInquiriesProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/contacts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInquiryDetails = async (id: string | number) => {
    try {
      const res = await fetch(`${serverUrl}/api/admin/contacts/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedInquiry(data);
        // Update it in list too
        setInquiries(prev => prev.map(q => q.id === id ? data : q));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Connect Admin Socket for Real-time alerts
  useEffect(() => {
    fetchInquiries();

    // Establish WebSocket Connection to /admin namespace
    const socket = io(`${serverUrl}/admin`, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      console.log("🔌 Live Admin Support Socket connected");
    });

    socket.on("contact:new", (newInq: Inquiry) => {
      setInquiries(prev => [newInq, ...prev]);
    });

    socket.on("contact:replied", ({ inquiryId, reply }: { inquiryId: string | number; reply: string }) => {
      // Update list status to resolved
      setInquiries(prev => prev.map(q => q.id === inquiryId ? { ...q, status: "resolved" } : q));
      
      // Update selected inquiry if open
      setSelectedInquiry(prev => {
        if (prev && prev.id === inquiryId) {
          const updatedReplies = prev.replies ? [...prev.replies] : [];
          // Add temporary reply object if not already present
          const alreadyExists = updatedReplies.some(r => r.reply === reply);
          if (!alreadyExists) {
            updatedReplies.push({
              id: Date.now(),
              admin_id: "System",
              reply,
              created_at: new Date().toISOString()
            });
          }
          return { ...prev, status: "resolved", replies: updatedReplies };
        }
        return prev;
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSendReply = async () => {
    if (!selectedInquiry || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/contacts/${selectedInquiry.id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reply: replyText })
      });
      if (res.ok) {
        setReplyText("");
        // Reload details
        await fetchInquiryDetails(selectedInquiry.id);
      } else {
        alert("Failed to submit reply.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] border border-white/10 rounded-xl overflow-hidden glass-dark text-white">
      {/* Left pane: Inquiry List */}
      <div className="w-1/3 border-r border-white/10 flex flex-col h-full bg-neutral-950/20">
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center space-x-2">
          <Inbox className="w-5 h-5 text-rose-500" />
          <h3 className="font-bold text-sm">Active Inquiries</h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading ? (
            <div className="p-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
            </div>
          ) : inquiries.length === 0 ? (
            <div className="p-10 text-center text-white/40 text-sm">
              No inquiries found.
            </div>
          ) : (
            inquiries.map((inq) => {
              const isSelected = selectedInquiry?.id === inq.id;
              const isNew = inq.status === "new";

              return (
                <button
                  key={inq.id}
                  onClick={() => fetchInquiryDetails(inq.id)}
                  className={`w-full text-left p-4 transition-colors flex flex-col space-y-1.5 ${
                    isSelected ? "bg-rose-500/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm truncate max-w-[120px]">
                      {inq.username}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {new Date(inq.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-xs text-white/80 font-medium truncate">
                    {inq.subject}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60 uppercase">
                      {inq.category}
                    </span>
                    {isNew ? (
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">NEW</span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">RESOLVED</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane: Inquiry conversation thread */}
      <div className="flex-1 flex flex-col h-full bg-neutral-900/40">
        {selectedInquiry ? (
          <>
            {/* Header info */}
            <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold">{selectedInquiry.subject}</h2>
                <div className="text-xs text-white/40 mt-1 flex items-center space-x-2">
                  <span>From: <strong>{selectedInquiry.username}</strong></span>
                  <span>•</span>
                  <span>Category: {selectedInquiry.category.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-rose-500" />
                <span className="text-xs uppercase text-rose-300 font-semibold">Priority: {selectedInquiry.priority}</span>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Sender original message */}
              <div className="flex space-x-3 items-start max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center font-semibold text-rose-300 text-xs shrink-0">
                  {selectedInquiry.username.substring(0,2).toUpperCase()}
                </div>
                <div className="bg-white/5 border border-white/15 p-4 rounded-xl rounded-tl-none">
                  <div className="text-xs text-white/40 mb-1 flex items-center space-x-2">
                    <span>{selectedInquiry.username}</span>
                    <span>•</span>
                    <span>{new Date(selectedInquiry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{selectedInquiry.message}</p>
                </div>
              </div>

              {/* Replies */}
              {selectedInquiry.replies?.map((reply) => (
                <div key={reply.id} className="flex space-x-3 items-start max-w-[85%] ml-auto justify-end">
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl rounded-tr-none text-right">
                    <div className="text-xs text-rose-400/80 mb-1 flex items-center space-x-2 justify-end">
                      <span>Administrator Reply</span>
                      <span>•</span>
                      <span>{new Date(reply.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{reply.reply}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-bold text-rose-300 text-xs shrink-0">
                    AD
                  </div>
                </div>
              ))}
            </div>

            {/* Reply sender textarea box */}
            <div className="p-4 border-t border-white/10 bg-white/5">
              <div className="relative flex items-center">
                <textarea
                  rows={2}
                  placeholder={`Write your response to ${selectedInquiry.username}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-16 text-sm text-white placeholder-white/35 focus:outline-none focus:border-rose-500 resize-none"
                />
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  className="absolute right-3 p-2 bg-rose-500 hover:bg-rose-400 disabled:bg-white/5 disabled:text-white/20 rounded-xl text-white transition-colors cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/40 space-y-2">
            <MessageSquare className="w-12 h-12 text-white/20 animate-pulse-soft" />
            <p className="text-sm">Select an inquiry from the panel to begin replying.</p>
          </div>
        )}
      </div>
    </div>
  );
}
