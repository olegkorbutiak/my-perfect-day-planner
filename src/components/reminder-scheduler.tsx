"use client";

import { useEffect, useRef } from "react";
import { useTasks } from "@/lib/tasks-context";
import { timeToMinutes } from "@/lib/date-utils";

const REMINDER_LEAD_MINUTES = 10;
const REMINDER_LEAD_MS = REMINDER_LEAD_MINUTES * 60 * 1000;

// Schedules browser notifications a bit ahead of upcoming timed tasks while
// this tab stays open. The Notification API has no reliable way to fire
// once the tab/app is closed without a push-capable backend, which this
// client-only app doesn't have.
export function ReminderScheduler() {
  const { tasks } = useTasks();
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const now = Date.now();

    for (const task of tasks) {
      if (task.done || task.archived || !task.dueDate || !task.dueTime) continue;

      const [y, m, d] = task.dueDate.split("-").map(Number);
      const minutes = timeToMinutes(task.dueTime);
      const dueAt = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60).getTime();
      const dueDelay = dueAt - now;

      if (dueDelay <= 0 || dueDelay > 24 * 60 * 60 * 1000) continue;
      // Fire REMINDER_LEAD_MINUTES ahead of the event, or right away if it's
      // already sooner than that lead time.
      const delay = Math.max(0, dueDelay - REMINDER_LEAD_MS);

      const id = window.setTimeout(() => {
        new Notification("Нагадування", { body: `${task.text} — о ${task.dueTime}`, tag: task.id });
      }, delay);
      timeoutsRef.current.push(id);
    }

    return () => {
      timeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
    };
  }, [tasks]);

  return null;
}
