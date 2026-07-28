"use client";

import { useEffect, useRef, useState } from "react";
import { useTasks } from "@/lib/tasks-context";
import { RestoreIcon } from "./icons";

const THRESHOLD = 64;
const MAX_PULL = 96;
const MIN_VISIBLE_MS = 500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const { pullGoogleCalendar } = useTasks();
  const containerRef = useRef<HTMLElement>(null);
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let dragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshing || el.scrollTop > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      dragging = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0 || el.scrollTop > 0) {
        dragging = false;
        startYRef.current = null;
        setPullDistance(0);
        return;
      }
      setPullDistance(Math.min(delta * 0.5, MAX_PULL));
      if (delta > 8) e.preventDefault();
    };

    const handleTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      startYRef.current = null;
      setPullDistance((current) => {
        if (current >= THRESHOLD) {
          setRefreshing(true);
          Promise.all([pullGoogleCalendar(), delay(MIN_VISIBLE_MS)]).finally(() => {
            setRefreshing(false);
          });
        }
        return 0;
      });
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [refreshing, pullGoogleCalendar]);

  const visualPull = refreshing ? THRESHOLD * 0.6 : pullDistance;

  return (
    <main
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-y-auto"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center transition-opacity"
        style={{ opacity: visualPull > 4 ? 1 : 0 }}
      >
        <div
          className="mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-brand-green shadow-card-hover"
          style={{
            transform: `translateY(${visualPull}px) rotate(${refreshing ? 0 : visualPull * 3}deg)`,
            transition: refreshing ? "transform 0.2s" : "none",
          }}
        >
          <RestoreIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </div>
      </div>
      {children}
    </main>
  );
}
