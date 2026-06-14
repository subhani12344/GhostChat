'use client';

import React, { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
}

export default function ReportModal({ isOpen, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState('nudity');
  const [details, setDetails] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason, details);
    setDetails('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-brand-black/40 hover:text-brand-black transition-colors"
        >
          <X size={20} />
        </button>

        {/* Heading */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-brand-black">Report Stranger</h3>
            <p className="text-xs text-brand-black/50">Help us maintain a safe community</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Reason for Report</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 px-3 text-sm text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white"
            >
              <option value="nudity">Explicit Content / Nudity</option>
              <option value="harassment">Harassment / Bullying</option>
              <option value="spam">Spam / Advertisements</option>
              <option value="scam">Scams / Fraudulent behavior</option>
              <option value="underage">Underage User (under 18)</option>
              <option value="other">Other Violation</option>
            </select>
          </div>

          {/* Details Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Optional Details</label>
            <textarea
              rows={3}
              placeholder="Describe the violation briefly..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 px-3 text-sm text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-brand-gray-mid/60 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-black hover:bg-brand-gray-light transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-brand-black py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-black/90 active:scale-95 transition-all"
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
