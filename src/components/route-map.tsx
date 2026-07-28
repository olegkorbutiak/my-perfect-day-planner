"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

type LatLon = { lat: number; lon: number };

export function RouteMap({
  from,
  to,
  geometry,
  liveCoord,
}: {
  from: LatLon;
  to: LatLon;
  geometry: [number, number][];
  liveCoord: LatLon | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const liveMarkerRef = useRef<CircleMarker | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const line = L.polyline(geometry, { color: "#2f9e44", weight: 5 }).addTo(map);
      L.circleMarker([from.lat, from.lon], {
        radius: 8,
        color: "#1c7ed6",
        fillColor: "#1c7ed6",
        fillOpacity: 1,
      }).addTo(map);
      L.circleMarker([to.lat, to.lon], {
        radius: 8,
        color: "#e03131",
        fillColor: "#e03131",
        fillOpacity: 1,
      }).addTo(map);

      map.fitBounds(line.getBounds(), { padding: [32, 32] });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      liveMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, from.lat, from.lon, to.lat, to.lon]);

  useEffect(() => {
    if (!liveCoord) return;
    (async () => {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (!map) return;
      if (!liveMarkerRef.current) {
        liveMarkerRef.current = L.circleMarker([liveCoord.lat, liveCoord.lon], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#2f9e44",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        liveMarkerRef.current.setLatLng([liveCoord.lat, liveCoord.lon]);
      }
      map.panTo([liveCoord.lat, liveCoord.lon]);
    })();
  }, [liveCoord]);

  return <div ref={containerRef} className="h-full w-full" />;
}
