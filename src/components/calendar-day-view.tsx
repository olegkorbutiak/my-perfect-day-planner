"use client";

import type { Task } from "@/lib/types";
import type { DailyForecast } from "@/lib/weather";
import type { Holiday } from "@/lib/holidays";
import { CalendarIcon, CheckIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { WeatherDayCard } from "@/components/weather-day-card";
import { HolidayBanner } from "@/components/holiday-banner";
import { formatDuration, timeToMinutes } from "@/lib/date-utils";

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 56;
const PX_PER_MIN = HOUR_HEIGHT / 60;

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  return (
    <li className="flex items-center gap-3 rounded-md bg-brand-surface p-3 shadow-card transition-all duration-200 hover:shadow-card-hover active:scale-[0.99]">
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-pressed={task.done}
        aria-label="Позначити виконаним"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 active:scale-90 ${
          task.done ? "border-brand-green bg-brand-green text-white" : "border-neutral-300"
        }`}
      >
        {task.done && <CheckIcon className="h-3.5 w-3.5 animate-pop" />}
      </button>
      <p
        className={`flex-1 text-sm transition-colors duration-300 ${
          task.done ? "text-neutral-400 line-through" : "text-brand-text"
        }`}
      >
        {task.text}
      </p>
    </li>
  );
}

export function CalendarDayView({
  dayTasks,
  onToggle,
  weatherDay,
  holiday,
}: {
  dayTasks: Task[];
  onToggle: (id: string) => void;
  weatherDay?: DailyForecast | null;
  holiday?: Holiday | null;
}) {
  const untimed = dayTasks.filter((t) => !t.dueTime);
  const timed = dayTasks.filter((t) => t.dueTime);

  if (dayTasks.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {(holiday || weatherDay) && (
          <div className="flex flex-col gap-2 px-5 pt-2">
            {holiday && <HolidayBanner holiday={holiday} />}
            {weatherDay && <WeatherDayCard day={weatherDay} taskTexts={[]} />}
          </div>
        )}
        <EmptyState
          icon={CalendarIcon}
          title="Тут поки порожньо"
          description="Задайте дату задачі у Вхідних, щоб побачити її тут."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5 pt-2">
      {holiday && <HolidayBanner holiday={holiday} />}
      {weatherDay && (
        <WeatherDayCard day={weatherDay} taskTexts={dayTasks.map((t) => t.text)} />
      )}

      {untimed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {untimed.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggle} />
          ))}
        </ul>
      )}

      <div className="relative flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
        <div className="relative w-12 shrink-0 text-right">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div
              key={i}
              style={{ top: i * HOUR_HEIGHT }}
              className="absolute right-2 -translate-y-2 font-condensed text-xs text-brand-muted"
            >
              {START_HOUR + i}:00
            </div>
          ))}
        </div>

        <div className="relative flex-1 rounded-md bg-brand-surface shadow-card">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div
              key={i}
              style={{ top: i * HOUR_HEIGHT }}
              className="absolute h-px w-full bg-neutral-100"
            />
          ))}

          {timed.map((task) => {
            const minutes = timeToMinutes(task.dueTime!);
            const top = Math.max(0, (minutes - START_HOUR * 60) * PX_PER_MIN);
            const minHeight = Math.max(44, (task.durationMinutes ?? 30) * PX_PER_MIN);
            const durationLabel = formatDuration(task.durationMinutes);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onToggle(task.id)}
                style={{ top, minHeight, zIndex: 1 }}
                className={`absolute left-1 right-1 rounded-md border-l-4 px-2 py-1.5 text-left shadow-sm transition-all duration-200 active:scale-[0.98] ${
                  task.done
                    ? "border-neutral-300 bg-neutral-100 text-neutral-400"
                    : "border-brand-green bg-brand-green/10 text-brand-text"
                }`}
              >
                <p className={`text-xs font-bold whitespace-nowrap ${task.done ? "line-through" : ""}`}>
                  {task.dueTime}
                  {durationLabel ? ` · ${durationLabel}` : ""}
                </p>
                <p className={`text-sm break-words ${task.done ? "line-through" : ""}`}>
                  {task.text}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
