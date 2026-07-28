"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NavigationIcon } from "@/components/icons";
import { LocationInput, type LocationSuggestion } from "@/components/location-input";
import { formatDuration } from "@/lib/date-utils";

const RouteMap = dynamic(() => import("@/components/route-map").then((m) => m.RouteMap), {
  ssr: false,
});

type LatLon = { lat: number; lon: number };
type RoutePlan = {
  from: LatLon & { name: string };
  to: LatLon & { name: string };
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

function getCurrentPosition(): Promise<LatLon> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Геолокація не підтримується цим браузером."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () =>
        reject(
          new Error(
            "Не вдалося визначити ваше місцезнаходження. Вкажіть точку відправлення текстом.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function formatArrival(durationSeconds: number): string {
  const now = new Date();
  const arrival = new Date(now.getTime() + durationSeconds * 1000);
  const time = arrival.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (arrival.toDateString() === now.toDateString()) return `о ${time}`;
  if (arrival.toDateString() === tomorrow.toDateString()) return `завтра о ${time}`;
  const date = arrival.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  return `${date} о ${time}`;
}

function parseCoord(latStr: string | null, lonStr: string | null): LatLon | null {
  if (!latStr || !lonStr) return null;
  const lat = Number(latStr);
  const lon = Number(lonStr);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

export function NavigationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toText = searchParams.get("to") ?? "";
  const fromText = searchParams.get("from") ?? "";
  const toLatStr = searchParams.get("toLat");
  const toLonStr = searchParams.get("toLon");
  const fromLatStr = searchParams.get("fromLat");
  const fromLonStr = searchParams.get("fromLon");

  const [loading, setLoading] = useState(Boolean(toText));
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [driving, setDriving] = useState(false);
  const [myLocation, setMyLocation] = useState<LatLon | null>(null);
  const [manualFrom, setManualFrom] = useState("");
  const [manualTo, setManualTo] = useState("");
  const [manualFromCoords, setManualFromCoords] = useState<LatLon | null>(null);
  const [manualToCoords, setManualToCoords] = useState<LatLon | null>(null);
  const [editing, setEditing] = useState(!toText);

  useEffect(() => {
    if (!toText) {
      setLoading(false);
      return;
    }
    // A route is being requested (URL already has ?to=...) — always show
    // progress/errors for it instead of leaving the input form up, which
    // otherwise silently swallowed failures (e.g. geolocation denied on
    // desktop with no "Звідки" text) behind the still-visible form.
    setEditing(false);

    let cancelled = false;
    const toCoords = parseCoord(toLatStr, toLonStr);
    const urlFromCoords = parseCoord(fromLatStr, fromLonStr);

    (async () => {
      setLoading(true);
      setError("");
      try {
        let fromCoords = urlFromCoords;
        if (!fromText && !fromCoords) {
          fromCoords = await getCurrentPosition();
        }
        const response = await fetch("/api/route-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toText,
            from: fromText || undefined,
            fromCoords: fromCoords ?? undefined,
            toCoords: toCoords ?? undefined,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Не вдалося побудувати маршрут");
        if (!cancelled) setPlan(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не вдалося побудувати маршрут");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toText, fromText, toLatStr, toLonStr, fromLatStr, fromLonStr]);

  // Ambient tracking so the map can show "you are here" as soon as this screen opens,
  // independent of whether a route has been planned yet.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Keep the editable fields in sync with the URL, e.g. after a voice/text command
  // routes here with ?to=...&from=..., so the inputs show what's currently planned.
  useEffect(() => {
    setManualTo(toText);
    setManualFrom(fromText);
    setManualToCoords(parseCoord(toLatStr, toLonStr));
    setManualFromCoords(parseCoord(fromLatStr, fromLonStr));
  }, [toText, fromText, toLatStr, toLonStr, fromLatStr, fromLonStr]);

  // Collapse the input form into a compact summary once a route is ready, so the
  // map (route + live position) isn't mostly covered by the overlay. Re-expand
  // automatically if the route is cleared.
  useEffect(() => {
    if (plan) setEditing(false);
  }, [plan]);
  useEffect(() => {
    if (!toText) setEditing(true);
  }, [toText]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTo.trim()) return;
    const params = new URLSearchParams({ to: manualTo.trim() });
    if (manualFrom.trim()) params.set("from", manualFrom.trim());
    if (manualToCoords) {
      params.set("toLat", String(manualToCoords.lat));
      params.set("toLon", String(manualToCoords.lon));
    }
    if (manualFromCoords) {
      params.set("fromLat", String(manualFromCoords.lat));
      params.set("fromLon", String(manualFromCoords.lon));
    }
    router.push(`/navigation?${params.toString()}`);
  };

  const handleSelectTo = (result: LocationSuggestion) => {
    setManualTo(result.label);
    setManualToCoords({ lat: result.lat, lon: result.lon });
  };

  const handleSelectFrom = (result: LocationSuggestion) => {
    setManualFrom(result.label);
    setManualFromCoords({ lat: result.lat, lon: result.lon });
  };

  const distanceKm = plan ? (plan.distanceMeters / 1000).toFixed(1) : null;
  const durationMin = plan ? Math.round(plan.durationSeconds / 60) : null;
  const durationLabel = durationMin !== null ? formatDuration(durationMin) : null;
  const arrivalLabel = useMemo(
    () => (plan ? formatArrival(plan.durationSeconds) : null),
    [plan],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <p className="font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
          Навігація
        </p>
      </div>

      <div className="relative min-h-0 flex-1 px-5 pb-5">
        {/* isolate: contains Leaflet's own high z-index panes/controls so they can't
            paint over the overlay card below, regardless of DOM order. */}
        <div className="isolate h-full w-full overflow-hidden rounded-md bg-neutral-100">
          <RouteMap
            route={plan}
            liveCoord={myLocation}
            follow={driving || (!plan && !loading)}
            bottomInset={220}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-5 bottom-5 z-10 flex flex-col gap-2">
          {editing && (
            <form
              onSubmit={handleManualSubmit}
              className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-black/5 bg-white/95 p-3 shadow-card-hover backdrop-blur-md"
            >
              <div className="flex flex-col gap-1.5">
                <LocationInput
                  value={manualFrom}
                  onChange={(text) => {
                    setManualFrom(text);
                    setManualFromCoords(null);
                  }}
                  onSelect={handleSelectFrom}
                  placeholder="Звідки (поточне місце)"
                  dotColor="#1c7ed6"
                />
                <LocationInput
                  value={manualTo}
                  onChange={(text) => {
                    setManualTo(text);
                    setManualToCoords(null);
                  }}
                  onSelect={handleSelectTo}
                  placeholder="Куди?"
                  dotColor="#e03131"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!manualTo.trim()}
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-brand-green text-center font-condensed text-sm font-bold uppercase tracking-wide text-white shadow-glow transition-all duration-200 active:scale-[0.98] active:bg-brand-green-strong disabled:opacity-30"
              >
                <NavigationIcon className="h-4 w-4" />
                Проклади маршрут
              </button>
            </form>
          )}

          {!editing && loading && (
            <div className="pointer-events-auto rounded-xl border border-black/5 bg-white/95 p-4 text-center text-sm text-brand-muted shadow-card-hover backdrop-blur-md">
              Будую маршрут…
            </div>
          )}

          {!editing && error && !loading && (
            <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-black/5 bg-white/95 p-4 text-center shadow-card-hover backdrop-blur-md">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-condensed text-xs font-bold uppercase tracking-wide text-brand-muted underline underline-offset-2"
              >
                Змінити маршрут
              </button>
            </div>
          )}

          {!editing && plan && !loading && !error && driving && (
            <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white/95 px-4 py-2.5 shadow-card-hover backdrop-blur-md">
              <p className="font-condensed text-sm font-bold uppercase tracking-wide text-brand-text">
                {durationLabel}
                <span className="text-brand-muted"> · прибуття {arrivalLabel}</span>
              </p>
              <button
                type="button"
                onClick={() => setDriving(false)}
                className="shrink-0 rounded-md bg-red-600 px-4 py-2 font-condensed text-xs font-bold uppercase tracking-wide text-white transition active:scale-95"
              >
                Зупинити
              </button>
            </div>
          )}

          {!editing && plan && !loading && !error && !driving && (
            <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-black/5 bg-white/95 p-3 shadow-card-hover backdrop-blur-md">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-center text-xs text-brand-muted underline underline-offset-2"
              >
                {plan.from.name} → {plan.to.name}
              </button>
              <p className="text-center font-condensed text-sm font-bold uppercase tracking-wide text-brand-text">
                {distanceKm} км · {durationLabel} · прибуття {arrivalLabel}
              </p>
              <button
                type="button"
                onClick={() => setDriving(true)}
                className="h-12 rounded-md bg-brand-green text-center font-condensed text-base font-bold uppercase tracking-wide text-white shadow-glow transition-all duration-200 active:scale-[0.98] active:bg-brand-green-strong"
              >
                Поїхали!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
