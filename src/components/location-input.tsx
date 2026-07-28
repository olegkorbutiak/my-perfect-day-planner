"use client";

import { useEffect, useRef, useState } from "react";
import { LocateIcon } from "@/components/icons";

export type LocationSuggestion = { label: string; lat: number; lon: number };

const DEBOUNCE_MS = 300;

export function LocationInput({
  value,
  onChange,
  onSelect,
  placeholder,
  dotColor,
  number,
  required,
  onLocate,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: LocationSuggestion) => void;
  placeholder: string;
  dotColor: string;
  /** Stop position (1 = start, 2, 3, ... = destination/waypoints) shown as a
   * numbered badge instead of a plain color dot, so a multi-stop route's
   * order is clear at a glance. */
  number: number;
  required?: boolean;
  /** Show a "use my location" button inside the field (right side) and call
   * this when it's tapped. */
  onLocate?: () => void;
}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode-suggest?text=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (cancelled) return;
        const results: LocationSuggestion[] = Array.isArray(data?.results) ? data.results : [];
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [value]);

  const handleSelect = (result: LocationSuggestion) => {
    skipNextFetchRef.current = true;
    setOpen(false);
    setSuggestions([]);
    onChange(result.label);
    onSelect(result);
  };

  return (
    <div className="relative flex items-center">
      <span
        className="pointer-events-none absolute left-2 flex h-5 w-5 items-center justify-center rounded-full font-condensed text-[10px] font-bold text-white"
        style={{ backgroundColor: dotColor }}
      >
        {number}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        required={required}
        className={`h-11 w-full rounded-md bg-neutral-100 pl-10 text-sm text-brand-text outline-none placeholder:text-neutral-400 ${
          onLocate ? "pr-10" : "pr-3"
        }`}
      />
      {onLocate && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onLocate}
          aria-label="Використати моє місцезнаходження"
          className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition active:scale-90 active:bg-brand-dark/[0.06]"
        >
          <LocateIcon className="h-4 w-4" />
        </button>
      )}
      {open && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md bg-white shadow-card-hover">
          {suggestions.map((s) => (
            <li key={`${s.lat},${s.lon}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s);
                }}
                className="w-full px-3 py-2 text-left text-sm text-brand-text transition active:bg-brand-dark/[0.06]"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
