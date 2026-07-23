"use client";

import { useState } from "react";
import { geocodeCity, type GeocodeResult } from "@/lib/weather";
import { setWeatherLocation, useWeatherLocation } from "@/lib/use-weather-location";

export function WeatherLocationPicker() {
  const location = useWeatherLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError("");
    try {
      const found = await geocodeCity(query);
      setResults(found);
      if (found.length === 0) setError("Місто не знайдено");
    } catch {
      setError("Не вдалося виконати пошук");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseGeolocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Геолокація не підтримується в цьому браузері");
      return;
    }
    setIsLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWeatherLocation({
          name: "Поточне місце",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setIsLocating(false);
        setIsOpen(false);
      },
      () => {
        setError("Не вдалося визначити місцезнаходження");
        setIsLocating(false);
      },
    );
  };

  const handlePick = (result: GeocodeResult) => {
    setWeatherLocation(result);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 self-start rounded-full bg-brand-dark/[0.06] px-3 py-1.5 text-xs font-medium text-brand-muted transition-all duration-200 active:scale-95"
      >
        📍 {location ? location.name : "Встановити місто для прогнозу"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-brand-surface p-3 shadow-card animate-fade-up">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Назва міста…"
          className="flex-1 rounded-md bg-brand-bg px-3 py-2 text-sm text-brand-text outline-none"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="shrink-0 rounded-md bg-brand-dark px-3 py-2 text-xs font-bold uppercase text-white transition active:scale-95 disabled:opacity-30"
        >
          {isSearching ? "…" : "Шукати"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleUseGeolocation}
        disabled={isLocating}
        className="rounded-md bg-brand-green/10 px-3 py-2 text-left text-sm font-medium text-brand-green transition active:scale-[0.98] disabled:opacity-50"
      >
        {isLocating ? "Визначаємо…" : "📍 Використати моє місцезнаходження"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-brand-text transition active:scale-[0.98] active:bg-brand-dark/[0.06]"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="text-center text-xs font-bold uppercase text-brand-muted"
      >
        Закрити
      </button>
    </div>
  );
}
