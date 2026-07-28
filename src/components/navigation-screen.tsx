"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "@/components/icons";

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [driving, setDriving] = useState(false);
  const [liveCoord, setLiveCoord] = useState<LatLon | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!toText) {
      setError("Немає кінцевої точки маршруту.");
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

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleStart = () => {
    if (!navigator.geolocation) return;
    setDriving(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setLiveCoord({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true },
    );
  };

  const handleStop = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setDriving(false);
    setLiveCoord(null);
  };

  const distanceKm = plan ? (plan.distanceMeters / 1000).toFixed(1) : null;
  const durationMin = plan ? Math.round(plan.durationSeconds / 60) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Назад"
          className="flex h-9 w-9 items-center justify-center rounded-md text-brand-text transition active:scale-90"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <p className="font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
          Навігація
        </p>
      </div>

      <div className="relative min-h-0 flex-1 px-5">
        <div className="h-full w-full overflow-hidden rounded-md bg-neutral-100">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-brand-muted">
              Будую маршрут…
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
              {error}
            </div>
          )}
          {plan && !loading && !error && (
            <RouteMap from={plan.from} to={plan.to} geometry={plan.geometry} liveCoord={liveCoord} />
          )}
        </div>
      </div>

      {plan && !loading && !error && (
        <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
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
              onClick={handleStart}
              className="h-16 rounded-md bg-brand-green text-center font-condensed text-lg font-bold uppercase tracking-wide text-white shadow-glow transition-all duration-200 active:scale-[0.98] active:bg-brand-green-strong"
            >
              Поїхали!
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="h-16 rounded-md bg-red-600 text-center font-condensed text-lg font-bold uppercase tracking-wide text-white transition-all duration-200 active:scale-[0.98]"
            >
              Зупинити
            </button>
          )}
        </div>
      )}
    </div>
  );
}
