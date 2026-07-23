"use client";

import type { Task } from "@/lib/types";
import { dayOfMonth, isSameMonth } from "@/lib/date-utils";

const WEEKDAY_HEADERS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "НД"];
const MAX_VISIBLE = 3;

export function CalendarMonthView({
  monthDays,
  monthAnchor,
  todayISO,
  tasks,
  onSelectDay,
}: {
  monthDays: string[];
  monthAnchor: string;
  todayISO: string;
  tasks: Task[];
  onSelectDay: (iso: string) => void;
}) {
  const tasksByDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const list = tasksByDay.get(task.dueDate) ?? [];
    list.push(task);
    tasksByDay.set(task.dueDate, list);
  }

  return (
    <div className="flex h-full flex-col px-2 pb-2">
      <div className="grid grid-cols-7 shrink-0">
        {WEEKDAY_HEADERS.map((label) => (
          <p
            key={label}
            className="py-1 text-center font-condensed text-xs font-bold uppercase tracking-wide text-brand-muted"
          >
            {label}
          </p>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-1">
        {monthDays.map((day) => {
          const dayTasks = tasksByDay.get(day) ?? [];
          const inMonth = isSameMonth(day, monthAnchor);
          const isToday = day === todayISO;
          const visible = dayTasks.slice(0, MAX_VISIBLE);
          const overflow = dayTasks.length - visible.length;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`flex flex-col items-stretch overflow-hidden rounded-md p-1 text-left transition-all duration-200 active:scale-[0.97] ${
                inMonth ? "bg-brand-surface shadow-card" : "bg-brand-surface/40"
              }`}
            >
              <span
                className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full font-condensed text-xs font-bold ${
                  isToday
                    ? "bg-brand-green text-white"
                    : inMonth
                      ? "text-brand-text"
                      : "text-neutral-300"
                }`}
              >
                {dayOfMonth(day)}
              </span>

              <div className="flex flex-1 flex-col gap-0.5">
                {visible.map((task) => (
                  <span
                    key={task.id}
                    className={`truncate rounded-sm px-1 text-[9px] leading-tight ${
                      task.done
                        ? "bg-neutral-100 text-neutral-400 line-through"
                        : "bg-brand-green/15 text-brand-text"
                    }`}
                  >
                    {task.text}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-[9px] font-bold text-brand-muted">
                    +{overflow}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
