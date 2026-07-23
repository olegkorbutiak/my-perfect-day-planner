"use client";

import type { DailyForecast } from "@/lib/weather";
import { getGeneralWeatherTip, getHikeAdvice, getWeatherInfo, isHikeRelated } from "@/lib/weather";

export function WeatherDayCard({
  day,
  taskTexts = [],
}: {
  day: DailyForecast;
  taskTexts?: string[];
}) {
  const { icon, label } = getWeatherInfo(day.weatherCode);
  const showHikeAdvice = isHikeRelated(taskTexts);
  const hikeAdvice = showHikeAdvice ? getHikeAdvice(day) : null;
  const generalTip = showHikeAdvice ? null : getGeneralWeatherTip(day);

  const adviceStyles: Record<string, string> = {
    good: "bg-brand-green/10 text-brand-green",
    moderate: "bg-amber-500/10 text-amber-600",
    bad: "bg-red-600/10 text-red-600",
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-brand-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex-1">
          <p className="font-condensed text-sm font-bold uppercase tracking-wide text-brand-text">
            {label}
          </p>
          <p className="text-xs text-brand-muted">
            {Math.round(day.tempMin)}° / {Math.round(day.tempMax)}° · 💧{day.precipitationProbability}%
            · 💨{Math.round(day.windSpeedMax)} км/год
          </p>
        </div>
      </div>

      {hikeAdvice && (
        <p className={`rounded-md px-3 py-2 text-sm font-medium ${adviceStyles[hikeAdvice.level]}`}>
          {hikeAdvice.text}
        </p>
      )}
      {generalTip && (
        <p className="rounded-md bg-brand-dark/[0.06] px-3 py-2 text-sm font-medium text-brand-text">
          {generalTip}
        </p>
      )}
    </div>
  );
}
