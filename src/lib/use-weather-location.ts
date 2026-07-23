"use client";

import { useSyncExternalStore } from "react";

export type WeatherLocation = { name: string; lat: number; lon: number };

const STORAGE_KEY = "ai-day-planner.weather-location";
const listeners = new Set<() => void>();
let cached: WeatherLocation | null | undefined;

function read(): WeatherLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WeatherLocation) : null;
  } catch {
    return null;
  }
}

function getSnapshot(): WeatherLocation | null {
  if (cached === undefined) cached = read();
  return cached;
}

function getServerSnapshot(): WeatherLocation | null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWeatherLocation(location: WeatherLocation | null) {
  cached = location;
  if (location) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((l) => l());
}

export function useWeatherLocation() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
