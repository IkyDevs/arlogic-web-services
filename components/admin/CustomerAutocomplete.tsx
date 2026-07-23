"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Phone, Search } from "lucide-react";

interface CustomerResult {
  name: string;
  phone: string;
  point?: number;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect: (name: string, phone: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  inputClass?: string;
  autoFocus?: boolean;
}

export default function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Nama customer",
  className = "",
  inputClass = "",
  autoFocus,
}: Props) {
  const supabase = createClient();
  const [suggestions, setSuggestions] = useState<CustomerResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    const trimmed = q.trim();

    try {
      // Split input: coba pars sebagai "nama digit_terakhir" atau "nama" atau "nomor"
      const parts = trimmed.split(/\s+/);
      let searchName = trimmed;
      let searchLastDigits = '';

      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        if (/^\d{1,}$/.test(lastPart)) {
          searchName = parts.slice(0, -1).join(' ');
          searchLastDigits = lastPart;
        }
      }

      let query = supabase
        .from("customers")
        .select("name, phone, point")
        .limit(10);

      if (searchLastDigits) {
        // Cari nama cocok + 4 digit terakhir phone
        query = query
          .ilike('name', `%${searchName}%`)
          .ilike('phone', `%${searchLastDigits}`);
      } else if (/^\d+$/.test(trimmed)) {
        // Cari by nomor telepon
        query = query.ilike('phone', `%${trimmed}%`);
      } else {
        // Cari by nama
        query = query.ilike('name', `%${trimmed}%`);
      }

      const { data } = await query;
      const list = (data || []).map((r) => ({ name: r.name, phone: r.phone, point: r.point }));
      setSuggestions(list);
      setShowDropdown(list.length > 0);
      setHighlightIdx(-1);
    } catch { /* ignore */ }
  }, [supabase]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchCustomers(value), 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, searchCustomers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatCode = (phone: string) => phone.length >= 4 ? phone.slice(-4) : phone;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      const s = suggestions[highlightIdx];
      onSelect(s.name, s.phone);
      setShowDropdown(false);
    }
    if (e.key === "Escape") setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          className={`w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 transition-all text-sm dark:text-gray-100 ${inputClass}`}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-[999] w-full mt-1 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg max-h-52 overflow-y-auto" style={{ position: 'absolute', top: '100%', left: 0 }}>
          {suggestions.map((s, i) => (
            <button
              key={s.phone || s.name}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s.name, s.phone); setShowDropdown(false); }}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${highlightIdx === i ? "bg-gray-50 dark:bg-white/5" : ""}`}
            >
              <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-xs flex-shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {s.phone || "-"}
                </div>
              </div>
              <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                {formatCode(s.phone)}
              </div>
            </button>
          ))}
        </div>
      )}
      {value && suggestions.length === 0 && !showDropdown && (
        <div className="absolute z-[999] w-full mt-1 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg p-3 text-center text-xs text-gray-400">
          Customer tidak ditemukan. Data akan disimpan sebagai customer baru.
        </div>
      )}
    </div>
  );
}
