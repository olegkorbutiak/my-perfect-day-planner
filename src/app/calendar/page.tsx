"use client";

import { useState } from "react";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  GridIcon,
  ListIcon,
} from "@/components/icons";
import { CalendarDayView } from "@/components/calendar-day-view";
import { CalendarWeekView } from "@/components/calendar-week-view";
import { CalendarMonthView } from "@/components/calendar-month-view";
import { WeatherLocationPicker } from "@/components/weather-location-picker";
import { useTasks } from "@/lib/tasks-context";
import { useTodayISO } from "@/lib/use-today";
import { useWeatherLocation } from "@/lib/use-weather-location";
import { useForecast } from "@/lib/use-forecast";
import {
  addDaysISO,
  addMonthsISO,
  diffDaysISO,
  formatDateLabel,
  formatMonthLabel,
  formatWeekRangeLabel,
  getMonthGridDays,
  getWeekStartISO,
} from "@/lib/date-utils";
import { downloadICS } from "@/lib/ics-export";

type ViewMode = "day" | "week" | "month";

export default function CalendarPage() {
  const { tasks, toggleDone } = useTasks();
  const todayISO = useTodayISO();
  const weatherLocation = useWeatherLocation();
  const { forecast } = useForecast(weatherLocation);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const selectedDate = addDaysISO(todayISO, dayOffset);
  const weekStart = getWeekStartISO(addDaysISO(todayISO, weekOffset * 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const monthAnchor = addMonthsISO(todayISO, monthOffset);
  const monthDays = getMonthGridDays(monthAnchor);
  const isToday = dayOffset === 0;

  const dayTasks = tasks
    .filter((t) => t.dueDate === selectedDate)
    .sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"));
  const dayForecast = forecast?.find((f) => f.date === selectedDate) ?? null;

  const navLabel =
    viewMode === "day"
      ? formatDateLabel(selectedDate, todayISO)
      : viewMode === "week"
        ? formatWeekRangeLabel(weekStart)
        : formatMonthLabel(monthAnchor);
  const pickerValue = viewMode === "day" ? selectedDate : viewMode === "week" ? weekStart : monthAnchor;

  const handlePrev = () => {
    if (viewMode === "day") setDayOffset((d) => d - 1);
    else if (viewMode === "week") setWeekOffset((w) => w - 1);
    else setMonthOffset((m) => m - 1);
  };
  const handleNext = () => {
    if (viewMode === "day") setDayOffset((d) => d + 1);
    else if (viewMode === "week") setWeekOffset((w) => w + 1);
    else setMonthOffset((m) => m + 1);
  };

  const handleDateInput = (value: string) => {
    if (!value) return;
    if (viewMode === "day") {
      setDayOffset(diffDaysISO(value, todayISO));
    } else if (viewMode === "week") {
      setWeekOffset(Math.round(diffDaysISO(getWeekStartISO(value), getWeekStartISO(todayISO)) / 7));
    } else {
      const [ty, tm] = value.slice(0, 7).split("-").map(Number);
      const [cy, cm] = todayISO.slice(0, 7).split("-").map(Number);
      setMonthOffset((ty - cy) * 12 + (tm - cm));
    }
  };

  const handleSelectDay = (iso: string) => {
    setDayOffset(diffDaysISO(iso, todayISO));
    setViewMode("day");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-md bg-brand-dark p-1">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              aria-pressed={viewMode === "day"}
              aria-label="Вигляд дня"
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 active:scale-90 ${
                viewMode === "day" ? "bg-brand-green text-white" : "text-white/50"
              }`}
            >
              <ListIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              aria-pressed={viewMode === "week"}
              aria-label="Вигляд тижня"
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 active:scale-90 ${
                viewMode === "week" ? "bg-brand-green text-white" : "text-white/50"
              }`}
            >
              <GridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              aria-pressed={viewMode === "month"}
              aria-label="Вигляд місяця"
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 active:scale-90 ${
                viewMode === "month" ? "bg-brand-green text-white" : "text-white/50"
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => downloadICS(tasks)}
            aria-label="Експортувати в .ics"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text transition-all duration-200 hover:bg-brand-dark/[0.06] active:scale-90"
          >
            <DownloadIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Попередній період"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-text transition-all duration-200 hover:bg-brand-dark/[0.06] active:scale-90"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>

          <div className="relative flex-1 overflow-hidden rounded-xl bg-brand-surface shadow-card">
            <p
              key={navLabel}
              className={`pointer-events-none animate-fade-up py-3 text-center font-condensed text-sm font-bold uppercase tracking-wide ${
                viewMode === "day" && isToday ? "text-brand-green" : "text-brand-text"
              }`}
            >
              {navLabel}
            </p>
            <input
              type="date"
              value={pickerValue}
              onChange={(e) => handleDateInput(e.target.value)}
              aria-label="Обрати дату"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <CalendarIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          </div>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Наступний період"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-text transition-all duration-200 hover:bg-brand-dark/[0.06] active:scale-90"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>

        {viewMode === "day" && <WeatherLocationPicker />}
      </div>

      {viewMode === "month" ? (
        <div key={navLabel} className="min-h-0 flex-1 animate-fade-up">
          <CalendarMonthView
            monthDays={monthDays}
            monthAnchor={monthAnchor}
            todayISO={todayISO}
            tasks={tasks}
            onSelectDay={handleSelectDay}
          />
        </div>
      ) : (
        <div key={viewMode + navLabel} className="min-h-0 flex-1 overflow-y-auto">
          {viewMode === "day" ? (
            <CalendarDayView dayTasks={dayTasks} onToggle={toggleDone} weatherDay={dayForecast} />
          ) : (
            <CalendarWeekView
              weekDays={weekDays}
              tasks={tasks}
              todayISO={todayISO}
              onToggle={toggleDone}
            />
          )}
        </div>
      )}
    </div>
  );
}
