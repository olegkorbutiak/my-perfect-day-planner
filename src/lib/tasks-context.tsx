"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";
import type { Task } from "./types";

const STORAGE_KEY = "ai-day-planner.tasks";
const EMPTY_TASKS: Task[] = [];

type StoredTask = Omit<Task, "archived" | "archivedAt"> &
  Partial<Pick<Task, "archived" | "archivedAt">>;

function readLocalTasks(): Task[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_TASKS;
    const parsed = JSON.parse(raw) as StoredTask[];
    return parsed.map((t) => ({
      archived: false,
      archivedAt: null,
      ...t,
    }));
  } catch {
    return EMPTY_TASKS;
  }
}

function writeLocalTasks(tasks: Task[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

type TaskRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  done: boolean;
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number | null;
  archived: boolean;
  archived_at: string | null;
};

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
    done: row.done,
    dueDate: row.due_date,
    dueTime: row.due_time,
    durationMinutes: row.duration_minutes,
    archived: row.archived,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  };
}

function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    text: task.text,
    created_at: new Date(task.createdAt).toISOString(),
    done: task.done,
    due_date: task.dueDate,
    due_time: task.dueTime,
    duration_minutes: task.durationMinutes,
    archived: task.archived,
    archived_at: task.archivedAt ? new Date(task.archivedAt).toISOString() : null,
  };
}

function createTask(
  text: string,
  dueDate: string | null = null,
  dueTime: string | null = null,
): Task {
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    done: false,
    dueDate,
    dueTime: dueDate ? dueTime : null,
    durationMinutes: null,
    archived: false,
    archivedAt: null,
  };
}

export type ParsedTask = { text: string; dueDate?: string | null; dueTime?: string | null };

type TasksContextValue = {
  tasks: Task[];
  addTask: (text: string) => void;
  addTasks: (parsedTasks: ParsedTask[]) => void;
  toggleDone: (id: string) => void;
  updateText: (id: string, text: string) => void;
  setDueDate: (id: string, dueDate: string | null) => void;
  setDueTime: (id: string, dueTime: string | null) => void;
  rescheduleTask: (id: string, dueDate: string | null, dueTime: string | null) => void;
  setDuration: (id: string, durationMinutes: number | null) => void;
  setDueDateForMany: (ids: string[], dueDate: string | null) => void;
  removeTask: (id: string) => void;
  restoreTask: (id: string) => void;
  deleteForever: (id: string) => void;
  pullGoogleCalendar: () => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(EMPTY_TASKS);
  const userId = user?.id ?? null;

  // Loads the right source of truth whenever sign-in state changes: the
  // user's cloud tasks once signed in (migrating any local tasks up on
  // first sign-in), or the local guest store otherwise.
  useEffect(() => {
    if (authLoading) return;

    if (!userId || !supabase) {
      Promise.resolve().then(() => setTasks(readLocalTasks()));
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load cloud tasks", error);
        setTasks(readLocalTasks());
        return;
      }

      if (data.length === 0) {
        const localTasks = readLocalTasks();
        if (localTasks.length > 0) {
          const { error: migrateError } = await supabase
            .from("tasks")
            .insert(localTasks.map((t) => taskToRow(t, userId)));
          if (migrateError) console.error("Failed to migrate local tasks", migrateError);
          if (!cancelled) setTasks(localTasks);
          return;
        }
      }

      if (!cancelled) setTasks(data.map(rowToTask));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  // Takes an updater (not a precomputed array) so that several mutations
  // fired in the same tick (e.g. multiple AI actions from one command) each
  // see the others' changes instead of clobbering them via a stale `tasks`
  // closure.
  const applyChange = useCallback(
    (updater: (prev: Task[]) => Task[]) => {
      setTasks((prev) => {
        const next = updater(prev);
        if (!userId) writeLocalTasks(next);
        return next;
      });
    },
    [userId],
  );

  const cloudInsert = useCallback(
    (newTasks: Task[]) => {
      if (!userId || !supabase) return;
      supabase
        .from("tasks")
        .insert(newTasks.map((t) => taskToRow(t, userId)))
        .then(({ error }) => error && console.error("Failed to save task", error));
    },
    [userId],
  );

  const cloudUpdate = useCallback(
    (ids: string[], patch: Partial<TaskRow>) => {
      if (!userId || !supabase) return;
      supabase
        .from("tasks")
        .update(patch)
        .in("id", ids)
        .then(({ error }) => error && console.error("Failed to update task", error));
    },
    [userId],
  );

  const cloudDelete = useCallback(
    (id: string) => {
      if (!userId || !supabase) return;
      supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .then(({ error }) => error && console.error("Failed to delete task", error));
    },
    [userId],
  );

  // Fires a background request that creates/updates/removes this task's
  // Google Calendar event to match its current due date/time/archived state.
  const syncCalendar = useCallback(
    (id: string) => {
      if (!userId || !supabase) return;
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        fetch("/api/calendar-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId: id }),
        }).catch((err) => console.error("Calendar sync failed", err));
      });
    },
    [userId],
  );

  const addTask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const created = createTask(trimmed);
      applyChange((prev) => [created, ...prev]);
      cloudInsert([created]);
      if (created.dueDate) syncCalendar(created.id);
    },
    [applyChange, cloudInsert, syncCalendar],
  );

  const addTasks = useCallback(
    (parsedTasks: ParsedTask[]) => {
      const created = parsedTasks
        .map((t) => ({
          text: t.text.trim(),
          dueDate: t.dueDate ?? null,
          dueTime: t.dueTime ?? null,
        }))
        .filter((t) => t.text)
        .map((t) => createTask(t.text, t.dueDate, t.dueTime));
      if (created.length === 0) return;
      applyChange((prev) => [...created, ...prev]);
      cloudInsert(created);
      created.forEach((t) => t.dueDate && syncCalendar(t.id));
    },
    [applyChange, cloudInsert, syncCalendar],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;
      const done = !target.done;
      applyChange((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
      cloudUpdate([id], { done });
    },
    [tasks, applyChange, cloudUpdate],
  );

  const updateText = useCallback(
    (id: string, text: string) => {
      applyChange((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
      cloudUpdate([id], { text });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const setDueDate = useCallback(
    (id: string, dueDate: string | null) => {
      applyChange((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                dueDate,
                dueTime: dueDate ? t.dueTime : null,
                durationMinutes: dueDate ? t.durationMinutes : null,
              }
            : t,
        ),
      );
      cloudUpdate([id], {
        due_date: dueDate,
        ...(dueDate ? {} : { due_time: null, duration_minutes: null }),
      });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const setDueTime = useCallback(
    (id: string, dueTime: string | null) => {
      applyChange((prev) => prev.map((t) => (t.id === id ? { ...t, dueTime } : t)));
      cloudUpdate([id], { due_time: dueTime });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  // Sets due date and (optionally) time together in one state update, so
  // callers that need both (e.g. an AI "reschedule" action) don't lose one
  // field to the other via two back-to-back calls racing against the same
  // stale state. A null dueTime means "leave the existing time as is", not
  // "clear it" — pass setDueTime/setDueDate directly if you need that.
  const rescheduleTask = useCallback(
    (id: string, dueDate: string | null, dueTime: string | null) => {
      applyChange((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                dueDate,
                dueTime: dueDate ? dueTime ?? t.dueTime : null,
                durationMinutes: dueDate ? t.durationMinutes : null,
              }
            : t,
        ),
      );
      cloudUpdate([id], {
        due_date: dueDate,
        ...(dueDate
          ? dueTime
            ? { due_time: dueTime }
            : {}
          : { due_time: null, duration_minutes: null }),
      });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const setDuration = useCallback(
    (id: string, durationMinutes: number | null) => {
      applyChange((prev) => prev.map((t) => (t.id === id ? { ...t, durationMinutes } : t)));
      cloudUpdate([id], { duration_minutes: durationMinutes });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const setDueDateForMany = useCallback(
    (ids: string[], dueDate: string | null) => {
      const idSet = new Set(ids);
      applyChange((prev) =>
        prev.map((t) =>
          idSet.has(t.id)
            ? {
                ...t,
                dueDate,
                dueTime: dueDate ? t.dueTime : null,
                durationMinutes: dueDate ? t.durationMinutes : null,
              }
            : t,
        ),
      );
      cloudUpdate(ids, {
        due_date: dueDate,
        ...(dueDate ? {} : { due_time: null, duration_minutes: null }),
      });
      ids.forEach((id) => syncCalendar(id));
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const removeTask = useCallback(
    (id: string) => {
      const archivedAt = Date.now();
      applyChange((prev) =>
        prev.map((t) => (t.id === id ? { ...t, archived: true, archivedAt } : t)),
      );
      cloudUpdate([id], { archived: true, archived_at: new Date(archivedAt).toISOString() });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const restoreTask = useCallback(
    (id: string) => {
      applyChange((prev) =>
        prev.map((t) => (t.id === id ? { ...t, archived: false, archivedAt: null } : t)),
      );
      cloudUpdate([id], { archived: false, archived_at: null });
      syncCalendar(id);
    },
    [applyChange, cloudUpdate, syncCalendar],
  );

  const deleteForever = useCallback(
    (id: string) => {
      applyChange((prev) => prev.filter((t) => t.id !== id));
      cloudDelete(id);
    },
    [applyChange, cloudDelete],
  );

  const refreshFromCloud = useCallback(async () => {
    if (!userId || !supabase) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) setTasks(data.map(rowToTask));
  }, [userId]);

  // Pulls events from the user's "My Perfect Day Planner" Google calendar
  // and reconciles them into tasks (new events become tasks, edited events
  // update their task, removed events archive their task). Returns a
  // promise so callers (e.g. pull-to-refresh) can await completion.
  const pullGoogleCalendar = useCallback(async () => {
    if (!userId || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      await fetch("/api/calendar-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      await refreshFromCloud();
    } catch (err) {
      console.error("Calendar pull failed", err);
    }
  }, [userId, refreshFromCloud]);

  return (
    <TasksContext.Provider
      value={{
        tasks,
        addTask,
        addTasks,
        toggleDone,
        updateText,
        setDueDate,
        setDueTime,
        rescheduleTask,
        setDuration,
        setDueDateForMany,
        removeTask,
        restoreTask,
        deleteForever,
        pullGoogleCalendar,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
