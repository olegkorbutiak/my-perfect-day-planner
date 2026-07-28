import { NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 8000;
const AUTOCOMPLETE_URL = "https://api.openrouteservice.org/geocode/autocomplete";

type Suggestion = { label: string; lat: number; lon: number };

export async function GET(request: Request) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ORS_API_KEY не налаштований на сервері" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim() ?? "";
  if (text.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = `${AUTOCOMPLETE_URL}?${new URLSearchParams({
    api_key: apiKey,
    text,
    size: "6",
    "boundary.country": "UA",
  })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(
    () => null,
  );
  if (!response || !response.ok) {
    return NextResponse.json({ results: [] });
  }

  const data = await response.json().catch(() => null);
  const rawFeatures = (data as { features?: unknown })?.features;
  const features = Array.isArray(rawFeatures) ? rawFeatures : [];

  const results: Suggestion[] = features
    .filter((f): f is { geometry?: unknown; properties?: unknown } => typeof f === "object" && f !== null)
    .map((f) => {
      const coords = (f.geometry as { coordinates?: unknown } | undefined)?.coordinates;
      const label = (f.properties as { label?: unknown } | undefined)?.label;
      if (!Array.isArray(coords) || coords.length < 2 || typeof label !== "string") return null;
      return { label, lat: coords[1], lon: coords[0] };
    })
    .filter((r): r is Suggestion => r !== null);

  return NextResponse.json({ results });
}
