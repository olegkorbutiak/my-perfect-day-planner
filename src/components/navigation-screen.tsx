"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NavigationIcon } from "@/components/icons";

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

export function NavigationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toText = searchParams.get("to") ?? "";
  const fromText = searchParams.get("from") ?? "";

  const [loading, setLoading] = useState(Boolean(toText));
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [driving, setDriving] = useState(false);
  const [myLocation, setMyLocation] = useState<LatLon | null>(null);
  const [manualFrom, setManualFrom] = useState("");
  const [manualTo, setManualTo] = useState("");

  useEffect(() => {
    if (!toText) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        let fromCoords: LatLon | null = null;
        if (!fromText) {
          fromCoords = await getCurrentPosition();
        }
        const response = await fetch("/api/route-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toText,
            from: fromText || undefined,
            fromCoords: fromCoords ?? undefined,
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
  }, [toText, fromText]);

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
  }, [toText, fromText]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTo.trim()) return;
    const params = new URLSearchParams({ to: manualTo.trim() });
    if (manualFrom.trim()) params.set("from", manualFrom.trim());
    router.push(`/navigation?${params.toString()}`);
  };

  const distanceKm = plan ? (plan.distanceMeters / 1000).toFixed(1) : null;
  const durationMin = plan ? Math.round(plan.durationSeconds / 60) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <p className="font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
          Навігація
        </p>
      </div>

      <div className="relative min-h-0 flex-1 px-5 pb-5">
        <div className="h-full w-full overflow-hidden rounded-md bg-neutral-100">
          <RouteMap
            route={plan}
            liveCoord={myLocation}
            follow={driving || (!plan && !loading)}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-5 bottom-5 flex flex-col gap-3">
          <form
            onSubmit={handleManualSubmit}
            className="pointer-events-auto flex flex-col gap-2 rounded-md bg-white/95 p-3 shadow-card-hover backdrop-blur"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={manualFrom}
                onChange={(e) => setManualFrom(e.target.value)}
                placeholder="Звідки (поточне місце)"
                className="h-11 flex-1 rounded-md bg-neutral-100 px-3 text-sm text-brand-text outline-none placeholder:text-neutral-400"
              />
              <input
                type="text"
                value={manualTo}
                onChange={(e) => setManualTo(e.target.value)}
                placeholder="Куди?"
                required
                className="h-11 flex-1 rounded-md bg-neutral-100 px-3 text-sm text-brand-text outline-none placeholder:text-neutral-400"
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

          {loading && (
            <div className="pointer-events-auto rounded-md bg-white/95 p-4 text-center text-sm text-brand-muted shadow-card-hover backdrop-blur">
              Будую маршрут…
            </div>
          )}

          {error && !loading && (
            <div className="pointer-events-auto rounded-md bg-white/95 p-4 text-center text-sm text-red-600 shadow-card-hover backdrop-blur">
              {error}
            </div>
          )}

          {plan && !loading && !error && (
            <div className="pointer-events-auto flex flex-col gap-3 rounded-md bg-white/95 p-4 shadow-card-hover backdrop-blur">
              <p className="text-center text-sm text-brand-muted">
                {plan.from.name} → {plan.to.name}
                <br />
                <span className="font-condensed font-bold uppercase tracking-wide text-brand-text">
                  {distanceKm} км · {durationMin} хв
                </span>
              </p>
              {!driving ? (
                <button
                  type="button"
                  onClick={() => setDriving(true)}
                  className="h-16 rounded-md bg-brand-green text-center font-condensed text-lg font-bold uppercase tracking-wide text-white shadow-glow transition-all duration-200 active:scale-[0.98] active:bg-brand-green-strong"
                >
                  Поїхали!
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDriving(false)}
                  className="h-16 rounded-md bg-red-600 text-center font-condensed text-lg font-bold uppercase tracking-wide text-white transition-all duration-200 active:scale-[0.98]"
                >
                  Зупинити
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
