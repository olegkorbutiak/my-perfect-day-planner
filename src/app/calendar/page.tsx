"use client";

import { useState } from "react";
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { useTasks } from "@/lib/tasks-context";
import { useTodayISO } from "@/lib/use-today";
import { addDaysISO, diffDaysISO, formatDateLabel } from "@/lib/date-utils";

export default function CalendarPage() {
  const { tasks, toggleDone } = useTasks();
  const todayISO = useTodayISO();
  const [dayOffset, setDayOffset] = useState(0);
  const selectedDate = addDaysISO(todayISO, dayOffset);
  const dayTasks = tasks
    .filter((t) => t.dueDate === selectedDate)
    .sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"));
  const isToday = dayOffset === 0;

  const handleDateInput = (value: string) => {
    if (!value) return;
    setDayOffset(diffDaysISO(value, todayISO));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => setDayOffset((d) => d - 1)}
          aria-label="Попередній день"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-text transition-all duration-200 hover:bg-brand-dark/[0.06] active:scale-90"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>

        <div className="relative flex-1 overflow-hidden rounded-xl bg-brand-surface shadow-card">
          <p
            key={selectedDate}
            className={`pointer-events-none animate-fade-up py-3 text-center font-condensed text-lg font-bold uppercase tracking-wide ${
              isToday ? "text-brand-green" : "text-brand-text"
            }`}
          >
            {formatDateLabel(selectedDate, todayISO)}
          </p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateInput(e.target.value)}
            aria-label="Обрати дату"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <CalendarIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-brand-muted" />
        </div>

        <button
          type="button"
          onClick={() => setDayOffset((d) => d + 1)}
          aria-label="Наступний день"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-text transition-all duration-200 hover:bg-brand-dark/[0.06] active:scale-90"
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>

      {dayTasks.length === 0 ? (
        <EmptyState
          key={selectedDate}
          icon={CalendarIcon}
          title="Тут поки порожньо"
          description="Задайте дату задачі в Inbox, щоб побачити її тут."
        />
      ) : (
        <div key={selectedDate} className="min-h-0 flex-1 overflow-y-auto p-5 pt-2">
          <ul className="flex flex-col gap-3">
            {dayTasks.map((task, index) => (
              <li
                key={task.id}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                className="flex animate-fade-up items-center gap-3 rounded-md bg-brand-surface p-4 shadow-card transition-all duration-200 hover:shadow-card-hover active:scale-[0.99]"
              >
                <button
                  type="button"
                  onClick={() => toggleDone(task.id)}
                  aria-pressed={task.done}
                  aria-label="Позначити виконаним"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 active:scale-90 ${
                    task.done
                      ? "border-brand-green bg-brand-green text-white"
                      : "border-neutral-300"
                  }`}
                >
                  {task.done && <CheckIcon className="h-4 w-4 animate-pop" />}
                </button>

                <p
                  className={`flex-1 text-base transition-colors duration-300 ${
                    task.done ? "text-neutral-400 line-through" : "text-brand-text"
                  }`}
                >
                  {task.text}
                </p>

                {task.dueTime && (
                  <span className="shrink-0 font-condensed text-xs font-bold uppercase tracking-wide text-brand-muted">
                    {task.dueTime}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
