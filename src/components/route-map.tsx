"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as LeafletNamespace from "leaflet";
import type { CircleMarker, Map as LeafletMap, Polyline } from "leaflet";
import { LocateIcon } from "@/components/icons";

type LatLon = { lat: number; lon: number };
type RouteData = { from: LatLon; to: LatLon; geometry: [number, number][] };

const UKRAINE_CENTER: [number, number] = [48.3794, 31.1656];
const UKRAINE_ZOOM = 6;
const LOCATION_ZOOM = 14;
const DRIVING_ZOOM = 16;

/** Closest point in a [lat, lon][] polyline to the given coordinate (plain
 * Euclidean comparison — good enough for picking "nearest", not for distance). */
function nearestPointOnLine(geometry: [number, number][], point: LatLon): [number, number] {
  let nearest = geometry[0];
  let minDistSq = Infinity;
  for (const p of geometry) {
    const distSq = (p[0] - point.lat) ** 2 + (p[1] - point.lon) ** 2;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      nearest = p;
    }
  }
  return nearest;
}

export function RouteMap({
  route,
  liveCoord,
  follow,
  bottomInset = 0,
}: {
  route: RouteData | null;
  liveCoord: LatLon | null;
  follow: boolean;
  /** Height (px) of overlay UI covering the bottom of the map, so the fitted
   * route is biased away from it instead of centering behind it. */
  bottomInset?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof LeafletNamespace | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const liveMarkerRef = useRef<CircleMarker | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const startMarkerRef = useRef<CircleMarker | null>(null);
  const endMarkerRef = useRef<CircleMarker | null>(null);
  const centeredOnLocationRef = useRef(false);
  const wasFollowingRef = useRef(false);
  // True once the user drags the map by hand — pauses auto-panning to the live
  // position so they can freely look at the route, until they tap "recenter".
  const userPannedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current).setView(UKRAINE_CENTER, UKRAINE_ZOOM);
      mapRef.current = map;
      map.on("dragstart", () => {
        userPannedRef.current = true;
      });

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

  // Draw/redraw the route. Synchronous (Leaflet is already loaded once `ready`
  // is true) so there's no async gap where an overlapping effect run could act
  // on stale ref values.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

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

    map.fitBounds(lineRef.current.getBounds(), {
      paddingTopLeft: [32, 32],
      paddingBottomRight: [32, bottomInset + 32],
      animate: false,
    });
    // bottomInset intentionally excluded: it only matters at the moment the route
    // is (re)drawn, not on every overlay height change while the same route is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, route]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !liveCoord) return;

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
      map.setView([liveCoord.lat, liveCoord.lon], LOCATION_ZOOM, { animate: false });
      centeredOnLocationRef.current = true;
      return;
    }

    if (!follow) {
      wasFollowingRef.current = false;
      return;
    }

    // Zoom in once, deliberately, right when following starts (e.g. "Поїхали!")
    // instead of relying on whatever zoom was already set — then only pan on
    // every later update so it never creeps in further. The ref is updated
    // synchronously (no async gap) so an overlapping effect run can't both see
    // it as "not following yet" and double-trigger this.
    if (!wasFollowingRef.current) {
      wasFollowingRef.current = true;
      // (Re)starting following is an explicit intent to snap back to live
      // tracking, even if the user had panned away earlier.
      userPannedRef.current = false;
      if (route) {
        // The live GPS fix and the route's own start point can disagree by a
        // fair bit (geocoding vs GPS, accuracy, etc.). Fit to the live point
        // plus the NEAREST point on the route (not the whole route, which
        // would just zoom back out to the full-route overview) so the view
        // is close/driving-level, while still guaranteed to touch the route.
        // Computed manually (getBoundsZoom + setView) rather than via
        // fitBounds — fitBounds was unreliable for some bounds/padding
        // combinations here, silently leaving the zoom unchanged.
        const nearest = nearestPointOnLine(route.geometry, liveCoord);
        const bounds = L.latLngBounds(
          [liveCoord.lat, liveCoord.lon],
          [nearest[0], nearest[1]],
        );
        const targetZoom = Math.min(
          map.getBoundsZoom(bounds, false, L.point(60, 60)),
          DRIVING_ZOOM,
        );
        map.setView(bounds.getCenter(), targetZoom, { animate: false });
      } else {
        map.setView([liveCoord.lat, liveCoord.lon], DRIVING_ZOOM, { animate: false });
      }
    } else if (!userPannedRef.current) {
      // animate: false — animated pans/zooms (fitBounds, panTo, or setView with
      // an unchanged zoom) turned out to silently no-op in some cases here;
      // the instant, non-animated path is the one that reliably applies.
      map.setView([liveCoord.lat, liveCoord.lon], map.getZoom(), { animate: false });
    }
  }, [ready, liveCoord, follow, route]);

  const handleRecenter = () => {
    userPannedRef.current = false;
    const map = mapRef.current;
    if (map && liveCoord) {
      map.setView([liveCoord.lat, liveCoord.lon], map.getZoom(), { animate: false });
    }
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {liveCoord && (
        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Показати моє місцезнаходження"
          className="absolute right-3 top-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-dark shadow-card-hover transition active:scale-90"
        >
          <LocateIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
