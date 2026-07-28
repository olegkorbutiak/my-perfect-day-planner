import { NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 10000;
const GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";
const DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

type GeoPoint = { name: string; lat: number; lon: number };

async function geocode(apiKey: string, text: string): Promise<GeoPoint | null> {
  const url = `${GEOCODE_URL}?${new URLSearchParams({
    api_key: apiKey,
    text,
    size: "1",
    "boundary.country": "UA",
  })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(
    () => null,
  );
  if (!response || !response.ok) return null;
  const data = await response.json().catch(() => null);
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return {
    name: feature?.properties?.label ?? text,
    lat: coords[1],
    lon: coords[0],
  };
}

async function getDirections(
  apiKey: string,
  from: GeoPoint,
  to: GeoPoint,
): Promise<
  | { geometry: [number, number][]; distanceMeters: number; durationSeconds: number }
  | { error: string }
> {
  const response = await fetch(DIRECTIONS_URL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [from.lon, from.lat],
        [to.lon, to.lat],
      ],
    }),
  }).catch((err) => {
    console.error("ORS directions request failed to send", err);
    return null;
  });
  if (!response) return { error: "Не вдалося з'єднатися зі службою маршрутів" };

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(
      "ORS directions error",
      response.status,
      JSON.stringify(data),
      "from",
      from,
      "to",
      to,
    );
    const orsMessage = data?.error?.message;
    // ORS error code 2010 = no routable road found near one of the points
    // (e.g. deep inside a rail yard / industrial site with no mapped road).
    if (data?.error?.code === 2010) {
      return { error: "Не знайдено дороги біля однієї з точок маршруту. Вкажіть точку відправлення точніше." };
    }
    return { error: orsMessage ? `Не вдалося побудувати маршрут: ${orsMessage}` : "Не вдалося побудувати маршрут" };
  }

  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  const summary = feature?.properties?.summary;
  if (!Array.isArray(coords) || !summary) {
    console.error("ORS directions returned unexpected shape", JSON.stringify(data));
    return { error: "Не вдалося побудувати маршрут" };
  }
  return {
    geometry: coords.map((c: [number, number]) => [c[1], c[0]]),
    distanceMeters: summary.distance,
    durationSeconds: summary.duration,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ORS_API_KEY не налаштований на сервері" }, { status: 500 });
  }

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
    fromCoords ? Promise.resolve(fromCoords) : geocode(apiKey, fromText),
    toCoords ? Promise.resolve(toCoords) : geocode(apiKey, toText),
  ]);

  if (!from) {
    return NextResponse.json(
      { error: `Не вдалося знайти місце «${fromText}»` },
      { status: 404 },
    );
  }
  if (!to) {
    return NextResponse.json({ error: `Не вдалося знайти місце «${toText}»` }, { status: 404 });
  }

  const directions = await getDirections(apiKey, from, to);
  if ("error" in directions) {
    return NextResponse.json({ error: directions.error }, { status: 502 });
  }

  return NextResponse.json({ from, to, ...directions });
}
