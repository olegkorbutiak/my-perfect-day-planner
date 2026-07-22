"use client";

import { CalendarIcon, CheckIcon, ClockIcon, InboxIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { useTasks } from "@/lib/tasks-context";
import { useTodayISO } from "@/lib/use-today";
import { formatScheduleLabel } from "@/lib/date-utils";

export default function InboxPage() {
  const { tasks, toggleDone, setDueDate, setDueTime } = useTasks();
  const todayISO = useTodayISO();

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <EmptyState
          icon={InboxIcon}
          title="В Inbox поки порожньо"
          description="Все, що ви занотуєте на екрані «Занотувати», з'явиться тут."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <ul className="flex flex-col gap-3">
        {tasks.map((task, index) => {
          const scheduleLabel = formatScheduleLabel(task.dueDate, task.dueTime, todayISO);
          return (
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

              <div className="flex-1">
                <p
                  className={`text-base transition-colors duration-300 ${
                    task.done ? "text-neutral-400 line-through" : "text-brand-text"
                  }`}
                >
                  {task.text}
                </p>
                {scheduleLabel && (
                  <p className="font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
                    {scheduleLabel}
                  </p>
                )}
              </div>

              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-dark text-white transition-transform duration-200 active:scale-90">
                <CalendarIcon className="h-5 w-5" />
                <input
                  type="date"
                  value={task.dueDate ?? ""}
                  aria-label="Призначити дату"
                  onChange={(e) => setDueDate(task.id, e.target.value || null)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>

              {task.dueDate && (
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-dark text-white transition-transform duration-200 active:scale-90">
                  <ClockIcon className="h-5 w-5" />
                  <input
                    type="time"
                    value={task.dueTime ?? ""}
                    aria-label="Призначити час"
                    onChange={(e) => setDueTime(task.id, e.target.value || null)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
