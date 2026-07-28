export type RouteStop = { text: string; coords: { lat: number; lon: number } | null };

/** Builds ?stop=...&stopLat=...&stopLon=... (repeated, index-aligned) for a
 * multi-stop route. lat/lon are omitted (empty) for stops with no known coords —
 * the server geocodes those by text instead. */
export function buildRouteSearchParams(
  stops: { text: string; lat?: number; lon?: number }[],
): URLSearchParams {
  const params = new URLSearchParams();
  for (const stop of stops) {
    params.append("stop", stop.text);
    params.append("stopLat", stop.lat !== undefined ? String(stop.lat) : "");
    params.append("stopLon", stop.lon !== undefined ? String(stop.lon) : "");
  }
  return params;
}

/** Reads the ?stop=/stopLat=/stopLon= triplets back out, index-aligned. */
export function parseRouteSearchParams(searchParams: {
  getAll: (key: string) => string[];
}): RouteStop[] {
  const texts = searchParams.getAll("stop");
  const lats = searchParams.getAll("stopLat");
  const lons = searchParams.getAll("stopLon");
  return texts.map((text, i) => {
    const lat = Number(lats[i]);
    const lon = Number(lons[i]);
    const hasCoords = lats[i] !== "" && lons[i] !== "" && Number.isFinite(lat) && Number.isFinite(lon);
    return { text, coords: hasCoords ? { lat, lon } : null };
  });
}
