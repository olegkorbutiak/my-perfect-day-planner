"use client";

import { useEffect, useState } from "react";
import { fetchForecast, type DailyForecast } from "./weather";
import type { WeatherLocation } from "./use-weather-location";

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { fetchedAt: number; data: DailyForecast[] }>();

function cacheKey(location: WeatherLocation) {
  return `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;
}

async function loadForecast(location: WeatherLocation): Promise<DailyForecast[]> {
  const key = cacheKey(location);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetchForecast(location.lat, location.lon);
  cache.set(key, { fetchedAt: Date.now(), data });
  return data;
}

export function useForecast(location: WeatherLocation | null) {
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      if (!location) {
        setForecast(null);
        setError("");
        return;
      }
      setIsLoading(true);
      setError("");
      loadForecast(location)
        .then((data) => {
          if (!cancelled) setForecast(data);
        })
        .catch(() => {
          if (!cancelled) setError("Не вдалося завантажити прогноз погоди");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [location]);

  return { forecast, isLoading, error };
}
