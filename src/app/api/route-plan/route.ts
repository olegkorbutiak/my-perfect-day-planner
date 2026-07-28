import { NextResponse } from "next/server";
import { geocodeOne, type GeoPoint } from "@/lib/geocoder";

const REQUEST_TIMEOUT_MS = 15000;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

async function getDirections(
  stops: GeoPoint[],
): Promise<
  | { geometry: [number, number][]; distanceMeters: number; durationSeconds: number }
  | { error: string }
> {
  const coordsPath = stops.map((s) => `${s.lon},${s.lat}`).join(";");
  const url = `${OSRM_URL}/${coordsPath}?overview=full&geometries=geojson`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(
    (err) => {
      console.error("OSRM directions request failed to send", err);
      return null;
    },
  );
  if (!response) return { error: "Не вдалося з'єднатися зі службою маршрутів" };

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.code !== "Ok") {
    console.error("OSRM directions error", response.status, JSON.stringify(data), "stops", stops);
    if (data?.code === "NoRoute") {
      return { error: "Не вдалося знайти дорогу між цими точками." };
    }
    return { error: "Не вдалося побудувати маршрут" };
  }

  const route = data?.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!Array.isArray(coords) || typeof route.distance !== "number") {
    console.error("OSRM directions returned unexpected shape", JSON.stringify(data));
    return { error: "Не вдалося побудувати маршрут" };
  }
  return {
    geometry: coords.map((c: [number, number]) => [c[1], c[0]]),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

type StopInput = { text?: string; coords?: { lat: number; lon: number } };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawStops = Array.isArray(body?.stops) ? (body.stops as unknown[]) : [];
  const stopInputs: StopInput[] = rawStops
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      text: typeof s.text === "string" ? s.text.trim() : undefined,
      coords:
        s.coords &&
        typeof (s.coords as { lat?: unknown }).lat === "number" &&
        typeof (s.coords as { lon?: unknown }).lon === "number"
          ? {
              lat: (s.coords as { lat: number }).lat,
              lon: (s.coords as { lon: number }).lon,
            }
          : undefined,
    }));

  if (stopInputs.length < 2) {
    return NextResponse.json({ error: "Потрібно щонайменше дві точки маршруту" }, { status: 400 });
  }

  const resolved = await Promise.all(
    stopInputs.map(async (stop, index) => {
      if (stop.coords) {
        return { name: stop.text || "Ваше місцезнаходження", lat: stop.coords.lat, lon: stop.coords.lon };
      }
      if (stop.text) {
        return geocodeOne(stop.text);
      }
      return null;
    }),
  );

  for (let i = 0; i < resolved.length; i++) {
    if (!resolved[i]) {
      const label = stopInputs[i].text;
      const error =
        i === 0 && !label
          ? "Не вказано точку відправлення"
          : label
            ? `Не вдалося знайти місце «${label}»`
            : "Не вказано точку маршруту";
      return NextResponse.json({ error }, { status: label ? 404 : 400 });
    }
  }

  const stops = resolved as GeoPoint[];
  const directions = await getDirections(stops);
  if ("error" in directions) {
    return NextResponse.json({ error: directions.error }, { status: 502 });
  }

  return NextResponse.json({ stops, ...directions });
}
