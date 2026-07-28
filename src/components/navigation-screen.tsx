"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavigationIcon, PlusIcon, XIcon } from "@/components/icons";
import { LocationInput, type LocationSuggestion } from "@/components/location-input";
import type { RouteMapHandle } from "@/components/route-map";
import { buildRouteSearchParams, parseRouteSearchParams, type RouteStop } from "@/lib/route-url";
import { formatDuration } from "@/lib/date-utils";

const RouteMap = dynamic(() => import("@/components/route-map").then((m) => m.RouteMap), {
  ssr: false,
});

type LatLon = { lat: number; lon: number };
type RoutePlan = {
  stops: (LatLon & { name: string })[];
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};
type FormStop = { text: string; coords: LatLon | null };

const EMPTY_STOPS: FormStop[] = [
  { text: "", coords: null },
  { text: "", coords: null },
];

// Each stop needing geocoding costs ~1s (self-throttled Nominatim requests,
// run one at a time) plus adds to the OSRM request — cap it to keep route
// building reasonably fast.
const MAX_STOPS = 8;

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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
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

function toFormStops(stops: RouteStop[]): FormStop[] {
  return stops.length >= 2
    ? stops.map((s) => ({ text: s.text, coords: s.coords }))
    : EMPTY_STOPS.map((s) => ({ ...s }));
}

export function NavigationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const urlStops = useMemo(() => parseRouteSearchParams(searchParams), [searchParamsKey]);
  const hasRouteRequest =
    urlStops.length >= 2 && urlStops[urlStops.length - 1].text.trim().length > 0;

  const [loading, setLoading] = useState(hasRouteRequest);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [driving, setDriving] = useState(false);
  const [myLocation, setMyLocation] = useState<LatLon | null>(null);
  const [manualStops, setManualStops] = useState<FormStop[]>(() => toFormStops(urlStops));
  const [editing, setEditing] = useState(!hasRouteRequest);
  const routeMapRef = useRef<RouteMapHandle>(null);

  useEffect(() => {
    if (!hasRouteRequest) {
      setLoading(false);
      return;
    }
    // A route is being requested (URL already has ?stop=...) — always show
    // progress/errors for it instead of leaving the input form up, which
    // otherwise silently swallowed failures (e.g. geolocation denied on
    // desktop with no "Звідки" text) behind the still-visible form.
    setEditing(false);

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const first = urlStops[0];
        // Prefer the ambient location already tracked for the "you are here"
        // dot — it has no strict timeout and has often already resolved by
        // the time a route is requested. Only fall back to a fresh one-off
        // request (which can time out on desktops without GPS) if needed.
        let firstCoords = first.coords ?? (!first.text ? myLocation : null);
        if (!first.text && !firstCoords) {
          firstCoords = await getCurrentPosition();
        }

        const stopsPayload = urlStops.map((stop, index) => ({
          text: stop.text || undefined,
          coords: (index === 0 ? firstCoords : stop.coords) ?? undefined,
        }));

        const response = await fetch("/api/route-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stops: stopsPayload }),
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
    // myLocation intentionally excluded: read as a fallback at the time this
    // fires, not a trigger to re-fetch the route every time it ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

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
  // routes here with ?stop=..., so the inputs show what's currently planned.
  useEffect(() => {
    setManualStops(toFormStops(urlStops));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  // Collapse the input form into a compact summary once a route is ready, so the
  // map (route + live position) isn't mostly covered by the overlay. Re-expand
  // automatically if the route is cleared.
  useEffect(() => {
    if (plan) setEditing(false);
  }, [plan]);
  useEffect(() => {
    if (!hasRouteRequest) setEditing(true);
  }, [hasRouteRequest]);

  const resetForm = () => {
    setManualStops(EMPTY_STOPS.map((s) => ({ ...s })));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const last = manualStops[manualStops.length - 1];
    if (!last.text.trim()) return;
    const params = buildRouteSearchParams(
      manualStops.map((s) => ({
        text: s.text.trim(),
        lat: s.coords?.lat,
        lon: s.coords?.lon,
      })),
    );
    router.push(`/navigation?${params.toString()}`);
  };

  const updateStopText = (index: number, text: string) => {
    setManualStops((prev) =>
      prev.map((s, i) => (i === index ? { text, coords: null } : s)),
    );
  };

  const selectStop = (index: number, result: LocationSuggestion) => {
    setManualStops((prev) =>
      prev.map((s, i) => (i === index ? { text: result.label, coords: { lat: result.lat, lon: result.lon } } : s)),
    );
  };

  const addStop = () => {
    setManualStops((prev) =>
      prev.length >= MAX_STOPS
        ? prev
        : [...prev.slice(0, prev.length - 1), { text: "", coords: null }, prev[prev.length - 1]],
    );
  };

  const removeStop = (index: number) => {
    setManualStops((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  };

  const distanceKm = plan ? (plan.distanceMeters / 1000).toFixed(1) : null;
  const durationMin = plan ? Math.round(plan.durationSeconds / 60) : null;
  const durationLabel = durationMin !== null ? formatDuration(durationMin) : null;
  const arrivalLabel = useMemo(
    () => (plan ? formatArrival(plan.durationSeconds) : null),
    [plan],
  );
  const routeSummary = plan ? plan.stops.map((s) => s.name).join(" → ") : "";

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
            ref={routeMapRef}
            route={plan}
            liveCoord={myLocation}
            follow={driving || (!plan && !loading)}
            bottomInset={220}
            showButton={!editing}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-5 bottom-5 z-10 flex flex-col gap-2">
          {editing && (
            <form
              onSubmit={handleManualSubmit}
              className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-black/5 bg-white/95 p-3 shadow-card-hover backdrop-blur-md"
            >
              <div className="flex flex-col gap-1.5">
                {manualStops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === manualStops.length - 1;
                  const placeholder = isFirst
                    ? "Звідки (поточне місце)"
                    : isLast
                      ? "Куди?"
                      : "Проміжна точка";
                  const dotColor = isFirst ? "#1c7ed6" : isLast ? "#e03131" : "#f59f00";
                  return (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <LocationInput
                          value={stop.text}
                          onChange={(text) => updateStopText(index, text)}
                          onSelect={(result) => selectStop(index, result)}
                          placeholder={placeholder}
                          dotColor={dotColor}
                          required={!isFirst}
                          onLocate={isFirst ? () => routeMapRef.current?.recenter() : undefined}
                        />
                      </div>
                      {manualStops.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeStop(index)}
                          aria-label="Видалити точку"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-brand-muted transition active:scale-90 active:bg-brand-dark/[0.06]"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {manualStops.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={addStop}
                  className="flex items-center justify-center gap-1.5 text-center font-condensed text-xs font-bold uppercase tracking-wide text-brand-muted transition active:scale-95"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Додати точку
                </button>
              )}
              <button
                type="submit"
                disabled={!manualStops[manualStops.length - 1].text.trim()}
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-brand-green text-center font-condensed text-sm font-bold uppercase tracking-wide text-white shadow-glow transition-all duration-200 active:scale-[0.98] active:bg-brand-green-strong disabled:opacity-30"
              >
                <NavigationIcon className="h-4 w-4" />
                Прокласти маршрут
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
                onClick={() => {
                  setDriving(false);
                  setEditing(true);
                  resetForm();
                }}
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
                {routeSummary}
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
