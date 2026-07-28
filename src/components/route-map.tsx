"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap, Polyline } from "leaflet";

type LatLon = { lat: number; lon: number };
type RouteData = { from: LatLon; to: LatLon; geometry: [number, number][] };

const UKRAINE_CENTER: [number, number] = [48.3794, 31.1656];
const UKRAINE_ZOOM = 6;
const LOCATION_ZOOM = 14;

export function RouteMap({
  route,
  liveCoord,
  follow,
}: {
  route: RouteData | null;
  liveCoord: LatLon | null;
  follow: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const liveMarkerRef = useRef<CircleMarker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const startMarkerRef = useRef<CircleMarker | null>(null);
  const endMarkerRef = useRef<CircleMarker | null>(null);
  const centeredOnLocationRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current).setView(UKRAINE_CENTER, UKRAINE_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (!map) return;

      lineRef.current?.remove();
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      lineRef.current = null;
      startMarkerRef.current = null;
      endMarkerRef.current = null;

      if (!route) return;

      lineRef.current = L.polyline(route.geometry, { color: "#2f9e44", weight: 5 }).addTo(map);
      startMarkerRef.current = L.circleMarker([route.from.lat, route.from.lon], {
        radius: 8,
        color: "#1c7ed6",
        fillColor: "#1c7ed6",
        fillOpacity: 1,
      }).addTo(map);
      endMarkerRef.current = L.circleMarker([route.to.lat, route.to.lon], {
        radius: 8,
        color: "#e03131",
        fillColor: "#e03131",
        fillOpacity: 1,
      }).addTo(map);

      map.fitBounds(lineRef.current.getBounds(), { padding: [32, 32] });
    })();
  }, [ready, route]);

  useEffect(() => {
    if (!ready || !liveCoord) return;
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

      if (!route && !centeredOnLocationRef.current) {
        map.setView([liveCoord.lat, liveCoord.lon], LOCATION_ZOOM);
        centeredOnLocationRef.current = true;
      } else if (follow) {
        map.panTo([liveCoord.lat, liveCoord.lon]);
      }
    })();
  }, [ready, liveCoord, follow, route]);

  return <div ref={containerRef} className="h-full w-full" />;
}
