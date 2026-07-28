const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MyPerfectDayPlanner/1.0 (contact: oleg.korbutiak@initservice.com.ua)";
const REQUEST_TIMEOUT_MS = 8000;
// Nominatim's usage policy caps public API use at ~1 request/second — this
// queue enforces a minimum gap between our own outgoing requests to it.
const MIN_INTERVAL_MS = 1100;

export type GeoPoint = { name: string; lat: number; lon: number };

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
  });
  queue = run;
  return run;
}

async function search(text: string, limit: number): Promise<GeoPoint[]> {
  await throttle();
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: text,
    format: "jsonv2",
    limit: String(limit),
    "accept-language": "uk",
  })}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  }).catch(() => null);
  if (!response || !response.ok) return [];

  const data = await response.json().catch(() => null);
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      const name = typeof item?.display_name === "string" ? item.display_name : text;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { name, lat, lon };
    })
    .filter((r): r is GeoPoint => r !== null);
}

export async function geocodeOne(text: string): Promise<GeoPoint | null> {
  const results = await search(text, 1);
  return results[0] ?? null;
}

export async function geocodeMany(text: string, limit: number): Promise<GeoPoint[]> {
  return search(text, limit);
}
