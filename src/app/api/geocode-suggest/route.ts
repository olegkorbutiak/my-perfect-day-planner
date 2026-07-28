import { NextResponse } from "next/server";
import { geocodeMany } from "@/lib/geocoder";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim() ?? "";
  if (text.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const points = await geocodeMany(text, 6);
  return NextResponse.json({
    results: points.map((p) => ({ label: p.name, lat: p.lat, lon: p.lon })),
  });
}
