'use client';

import React, { useState } from 'react';
import { Tag, Globe, MessageSquareCode, X } from 'lucide-react';

interface MatchingFiltersProps {
  interests: string[];
  setInterests: (tags: string[]) => void;
  language: string;
  setLanguage: (lang: string) => void;
  country: string;
  setCountry: (country: string) => void;
}

const COUNTRIES = [
  { code: 'all', name: 'Global Match' },
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' }
];

const LANGUAGES = [
  { code: 'all', name: 'Any Language' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'pt', name: 'Portuguese' }
];

export default function MatchingFilters({
  interests,
  setInterests,
  language,
  setLanguage,
  country,
  setCountry
}: MatchingFiltersProps) {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tagInput.trim().toLowerCase();
    if (cleanTag && !interests.includes(cleanTag)) {
      setInterests([...interests, cleanTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setInterests(interests.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="w-full space-y-4 rounded-2xl border border-brand-gray-mid/60 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-bold uppercase tracking-wider text-brand-black/70">Matching Preferences</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Country Filter */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-black/50">
            <Globe size={13} />
            Country Preference
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 px-3 text-sm text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Language Filter */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-black/50">
            <MessageSquareCode size={13} />
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 px-3 text-sm text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interests Tags input */}
      <div className="space-y-2 border-t border-brand-gray-mid/30 pt-3">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-black/50">
          <Tag size={13} />
          Interests Tags (optional matching)
        </label>
        <form onSubmit={handleAddTag} className="flex gap-2">
          <input
            type="text"
            placeholder="Add interest (e.g. gaming, music)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="flex-grow rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2 px-3.5 text-sm text-brand-black placeholder-brand-black/35 outline-none transition-all focus:border-brand-black focus:bg-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-black px-4 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95"
          >
            Add
          </button>
        </form>

        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {interests.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-brand-gray-light border border-brand-gray-mid/40 px-2.5 py-1 text-xs text-brand-black"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-brand-black/40 hover:text-brand-black transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
