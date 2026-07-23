"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  HourglassIcon,
  InboxIcon,
  SearchIcon,
  SelectCheckIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { NotificationBanner } from "@/components/notification-banner";
import { SwipeableRow } from "@/components/swipeable-row";
import { useTasks } from "@/lib/tasks-context";
import { useTodayISO } from "@/lib/use-today";
import { formatScheduleLabel } from "@/lib/date-utils";
import type { Task } from "@/lib/types";

const DURATION_OPTIONS = [
  { value: "", label: "Без тривалості" },
  { value: "15", label: "15 хв" },
  { value: "30", label: "30 хв" },
  { value: "45", label: "45 хв" },
  { value: "60", label: "1 год" },
  { value: "90", label: "1 год 30 хв" },
  { value: "120", label: "2 год" },
  { value: "180", label: "3 год" },
  { value: "240", label: "4 год" },
];

function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 48)}px`;
}

type SortMode = "created" | "alpha" | "undated" | "chrono";

function compareChrono(a: Task, b: Task): number {
  if (a.dueDate === null && b.dueDate === null) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueTime === null && b.dueTime === null) return 0;
  if (a.dueTime === null) return -1;
  if (b.dueTime === null) return 1;
  return a.dueTime.localeCompare(b.dueTime);
}

function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  if (mode === "alpha") {
    return [...tasks].sort((a, b) => a.text.localeCompare(b.text, "uk"));
  }
  if (mode === "undated") {
    return [...tasks].sort((a, b) => {
      const aRank = a.dueDate === null ? 0 : 1;
      const bRank = b.dueDate === null ? 0 : 1;
      return aRank - bRank;
    });
  }
  if (mode === "chrono") {
    return [...tasks].sort(compareChrono);
  }
  return tasks;
}

export default function InboxPage() {
  const {
    tasks,
    toggleDone,
    updateText,
    setDueDate,
    setDueTime,
    setDuration,
    setDueDateForMany,
    removeTask,
  } = useTasks();
  const todayISO = useTodayISO();

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("chrono");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const pendingTimeoutRef = useRef<number | null>(null);

  const commitPendingDelete = () => {
    if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = null;
    setPendingDelete((current) => {
      if (current) removeTask(current.id);
      return null;
    });
  };

  const handleDelete = (task: Task) => {
    commitPendingDelete();
    setPendingDelete(task);
    pendingTimeoutRef.current = window.setTimeout(() => {
      removeTask(task.id);
      setPendingDelete(null);
      pendingTimeoutRef.current = null;
    }, 5000);
  };

  const handleUndo = () => {
    if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = null;
    setPendingDelete(null);
  };

  const visibleTasks = useMemo(() => {
    const active = tasks.filter((t) => {
      if (t.archived) return false;
      if (pendingDelete && t.id === pendingDelete.id) return false;
      const isOverdue = t.dueDate !== null && t.dueDate < todayISO && !t.done;
      return !isOverdue;
    });
    const filtered = search.trim()
      ? active.filter((t) => t.text.toLowerCase().includes(search.trim().toLowerCase()))
      : active;
    return sortTasks(filtered, sortMode);
  }, [tasks, search, sortMode, pendingDelete, todayISO]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDate = (value: string) => {
    if (!value || selectedIds.size === 0) return;
    setDueDateForMany(Array.from(selectedIds), value);
    exitSelectMode();
  };

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col p-5">
        <NotificationBanner />
        <EmptyState
          icon={InboxIcon}
          title="У Вхідних поки порожньо"
          description="Все, що ви занотуєте на екрані «Занотувати», з'явиться тут."
          actionLabel="Занотувати зараз →"
          actionHref="/"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-col gap-2 px-5 pt-4 pb-2">
        <NotificationBanner />

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук задач…"
              className="w-full rounded-md bg-brand-surface py-2 pr-3 pl-9 text-sm text-brand-text shadow-card outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            aria-pressed={selectMode}
            aria-label="Режим вибору"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all duration-200 active:scale-90 ${
              selectMode ? "bg-brand-green text-white" : "bg-brand-surface text-brand-text shadow-card"
            }`}
          >
            <SelectCheckIcon className="h-5 w-5" />
          </button>
        </div>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="self-start rounded-md bg-brand-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted shadow-card outline-none"
        >
          <option value="created">Спочатку нові</option>
          <option value="alpha">За назвою</option>
          <option value="undated">Спочатку без дати</option>
          <option value="chrono">За послідовністю подій</option>
        </select>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto px-5 ${
          selectMode && selectedIds.size > 0 ? "pb-24" : "pb-5"
        }`}
      >
        {visibleTasks.length === 0 && search.trim() ? (
          <p className="animate-fade-up pt-10 text-center text-sm text-brand-muted">
            Нічого не знайдено за запитом «{search}»
          </p>
        ) : visibleTasks.length === 0 ? (
          <p className="animate-fade-up pt-10 text-center text-sm text-brand-muted">
            Усі задачі прострочені або в архіві. Перевірте{" "}
            <Link href="/archive" className="font-bold text-brand-green underline underline-offset-2">
              Архів
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleTasks.map((task, index) => {
              const scheduleLabel = formatScheduleLabel(
                task.dueDate,
                task.dueTime,
                task.durationMinutes,
                todayISO,
              );
              const isSelected = selectedIds.has(task.id);
              const isChecked = selectMode ? isSelected : task.done;

              return (
                <li
                  key={task.id}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  className="animate-fade-up"
                >
                  <SwipeableRow
                    disabled={selectMode}
                    onSwipeLeft={() => handleDelete(task)}
                    onSwipeRight={() => toggleDone(task.id)}
                  >
                    <div
                      className={`flex flex-col gap-2 rounded-md bg-brand-surface p-4 shadow-card transition-all duration-200 hover:shadow-card-hover ${
                        isSelected ? "ring-2 ring-brand-green" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            selectMode ? toggleSelected(task.id) : toggleDone(task.id)
                          }
                          aria-pressed={isChecked}
                          aria-label={selectMode ? "Вибрати задачу" : "Позначити виконаним"}
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 active:scale-90 ${
                            isChecked
                              ? "border-brand-green bg-brand-green text-white"
                              : "border-neutral-300"
                          }`}
                        >
                          {isChecked && <CheckIcon className="h-4 w-4 animate-pop" />}
                        </button>

                        <textarea
                          ref={autoResizeTextarea}
                          value={task.text}
                          onChange={(e) => {
                            updateText(task.id, e.target.value);
                            autoResizeTextarea(e.target);
                          }}
                          rows={1}
                          aria-label="Текст задачі"
                          disabled={selectMode}
                          className={`mt-1 max-h-12 flex-1 resize-none overflow-y-auto bg-transparent text-base leading-6 break-words outline-none transition-colors duration-300 disabled:opacity-60 ${
                            task.done ? "text-neutral-400 line-through" : "text-brand-text"
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => handleDelete(task)}
                          aria-label="Видалити задачу"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-600/10 text-red-600 transition-all duration-200 active:scale-90 active:bg-red-600/20"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>


                      {scheduleLabel && (
                        <p className="pl-11 font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
                          {scheduleLabel}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pl-11">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-dark text-white transition-transform duration-200 active:scale-90">
                          <CalendarIcon className="h-4 w-4" />
                          <input
                            type="date"
                            value={task.dueDate ?? ""}
                            aria-label="Призначити дату"
                            onChange={(e) => setDueDate(task.id, e.target.value || null)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>

                        {task.dueDate && (
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-dark text-white transition-transform duration-200 active:scale-90">
                            <ClockIcon className="h-4 w-4" />
                            <input
                              type="time"
                              value={task.dueTime ?? ""}
                              aria-label="Призначити час"
                              onChange={(e) => setDueTime(task.id, e.target.value || null)}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                          </div>
                        )}

                        {task.dueDate && (
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-dark text-white transition-transform duration-200 active:scale-90">
                            <HourglassIcon className="h-4 w-4" />
                            <select
                              value={task.durationMinutes ?? ""}
                              aria-label="Тривалість задачі"
                              onChange={(e) =>
                                setDuration(task.id, e.target.value ? Number(e.target.value) : null)
                              }
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            >
                              {DURATION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </SwipeableRow>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div className="absolute right-4 bottom-20 left-4 flex animate-fade-up items-center gap-3 rounded-xl bg-brand-dark p-3 shadow-card-hover">
          <p className="flex-1 text-sm font-medium text-white">{selectedIds.size} вибрано</p>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-green text-white">
            <CalendarIcon className="h-5 w-5" />
            <input
              type="date"
              aria-label="Призначити дату вибраним"
              onChange={(e) => handleBulkDate(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <button
            type="button"
            onClick={exitSelectMode}
            aria-label="Скасувати вибір"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-white transition active:scale-90"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {pendingDelete && (
        <div
          className={`absolute right-4 left-4 flex animate-fade-up items-center gap-3 rounded-xl bg-brand-dark p-3 shadow-card-hover ${
            selectMode && selectedIds.size > 0 ? "bottom-36" : "bottom-20"
          }`}
        >
          <p className="flex-1 truncate text-sm text-white">
            Видалено: <span className="font-medium">{pendingDelete.text}</span>
          </p>
          <button
            type="button"
            onClick={handleUndo}
            className="shrink-0 font-condensed text-sm font-bold uppercase tracking-wide text-brand-green transition active:scale-95"
          >
            Скасувати
          </button>
        </div>
      )}
    </div>
  );
}
