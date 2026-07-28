import { NextResponse } from "next/server";
import { geocodeOne, type GeoPoint } from "@/lib/geocoder";

const REQUEST_TIMEOUT_MS = 10000;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

async function getDirections(
  from: GeoPoint,
  to: GeoPoint,
): Promise<
  | { geometry: [number, number][]; distanceMeters: number; durationSeconds: number }
  | { error: string }
> {
  const url = `${OSRM_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(
    (err) => {
      console.error("OSRM directions request failed to send", err);
      return null;
    },
  );
  if (!response) return { error: "Не вдалося з'єднатися зі службою маршрутів" };

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.code !== "Ok") {
    console.error(
      "OSRM directions error",
      response.status,
      JSON.stringify(data),
      "from",
      from,
      "to",
      to,
    );
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const toText = typeof body?.to === "string" ? body.to.trim() : "";
  const fromText = typeof body?.from === "string" ? body.from.trim() : "";
  const fromCoords =
    body?.fromCoords &&
    typeof body.fromCoords.lat === "number" &&
    typeof body.fromCoords.lon === "number"
      ? { name: fromText || "Ваше місцезнаходження", lat: body.fromCoords.lat, lon: body.fromCoords.lon }
      : null;
  const toCoords =
    body?.toCoords && typeof body.toCoords.lat === "number" && typeof body.toCoords.lon === "number"
      ? { name: toText, lat: body.toCoords.lat, lon: body.toCoords.lon }
      : null;

  if (!toText) {
    return NextResponse.json({ error: "Не вказано кінцеву точку маршруту" }, { status: 400 });
  }
  if (!fromText && !fromCoords) {
    return NextResponse.json({ error: "Не вказано початкову точку маршруту" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    fromCoords ? Promise.resolve(fromCoords) : geocodeOne(fromText),
    toCoords ? Promise.resolve(toCoords) : geocodeOne(toText),
  ]);

  if (!from) {
    return NextResponse.json({ error: `Не вдалося знайти місце «${fromText}»` }, { status: 404 });
  }
  if (!to) {
    return NextResponse.json({ error: `Не вдалося знайти місце «${toText}»` }, { status: 404 });
  }

  const directions = await getDirections(from, to);
  if ("error" in directions) {
    return NextResponse.json({ error: directions.error }, { status: 502 });
  }

  return NextResponse.json({ from, to, ...directions });
}
