export type DailyForecast = {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  windSpeedMax: number;
  weatherCode: number;
};

export type GeocodeResult = { name: string; lat: number; lon: number };

const WEATHER_INFO: Record<number, { label: string; icon: string }> = {
  0: { label: "Ясно", icon: "☀️" },
  1: { label: "Переважно ясно", icon: "🌤️" },
  2: { label: "Мінлива хмарність", icon: "⛅" },
  3: { label: "Хмарно", icon: "☁️" },
  45: { label: "Туман", icon: "🌫️" },
  48: { label: "Туман з інеєм", icon: "🌫️" },
  51: { label: "Легка мряка", icon: "🌦️" },
  53: { label: "Мряка", icon: "🌦️" },
  55: { label: "Сильна мряка", icon: "🌧️" },
  56: { label: "Морозна мряка", icon: "🌧️" },
  57: { label: "Сильна морозна мряка", icon: "🌧️" },
  61: { label: "Легкий дощ", icon: "🌦️" },
  63: { label: "Дощ", icon: "🌧️" },
  65: { label: "Сильний дощ", icon: "🌧️" },
  66: { label: "Льодяний дощ", icon: "🌧️" },
  67: { label: "Сильний льодяний дощ", icon: "🌧️" },
  71: { label: "Легкий снігопад", icon: "🌨️" },
  73: { label: "Снігопад", icon: "🌨️" },
  75: { label: "Сильний снігопад", icon: "❄️" },
  77: { label: "Снігові зерна", icon: "🌨️" },
  80: { label: "Короткочасний дощ", icon: "🌦️" },
  81: { label: "Дощові зливи", icon: "🌧️" },
  82: { label: "Сильні зливи", icon: "⛈️" },
  85: { label: "Снігові зливи", icon: "🌨️" },
  86: { label: "Сильні снігові зливи", icon: "❄️" },
  95: { label: "Гроза", icon: "⛈️" },
  96: { label: "Гроза з градом", icon: "⛈️" },
  99: { label: "Сильна гроза з градом", icon: "⛈️" },
};

export function getWeatherInfo(code: number): { label: string; icon: string } {
  return WEATHER_INFO[code] ?? { label: "Невідомо", icon: "🌡️" };
}

export async function geocodeCity(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=5&language=uk&format=json`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  type RawResult = { name: string; admin1?: string; country?: string; latitude: number; longitude: number };
  return ((data.results ?? []) as RawResult[]).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function fetchForecast(lat: number, lon: number): Promise<DailyForecast[]> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode&timezone=auto&forecast_days=16`,
  );
  if (!res.ok) throw new Error("Не вдалося завантажити прогноз погоди");
  const data = await res.json();
  const d = data.daily;
  return (d.time as string[]).map((date, i) => ({
    date,
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    precipitationProbability: d.precipitation_probability_max[i],
    windSpeedMax: d.windspeed_10m_max[i],
    weatherCode: d.weathercode[i],
  }));
}

export type HikeAdviceLevel = "good" | "moderate" | "bad";

const BAD_CODES = new Set([65, 66, 67, 75, 77, 82, 86, 95, 96, 99]);
const WET_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 71, 73, 80, 81, 85]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const THUNDER_CODES = new Set([95, 96, 99]);

const HIKE_KEYWORDS = [
  "похід", "поход", "гори", "гору", "гірськ", "трек", "хайк",
  "вершина", "сходження", "кемпінг", "турист",
];

/** Whether any of the given task titles mention a hike/mountain trip. */
export function isHikeRelated(taskTexts: string[]): boolean {
  return taskTexts.some((text) => {
    const lower = text.toLowerCase();
    return HIKE_KEYWORDS.some((kw) => lower.includes(kw));
  });
}

export function getHikeAdvice(day: DailyForecast): { level: HikeAdviceLevel; text: string } {
  if (BAD_CODES.has(day.weatherCode) || day.precipitationProbability >= 70 || day.windSpeedMax >= 50) {
    return { level: "bad", text: "Не рекомендується йти в похід — складні погодні умови" };
  }
  if (
    WET_CODES.has(day.weatherCode) ||
    day.precipitationProbability >= 35 ||
    day.windSpeedMax >= 30 ||
    day.tempMax <= 3 ||
    day.tempMax >= 33
  ) {
    return { level: "moderate", text: "Помірні умови — візьміть додаткове спорядження" };
  }
  return { level: "good", text: "Гарний день для походу в гори" };
}

/** A general, non-hiking-specific weather tip. Null when there's nothing notable to flag. */
export function getGeneralWeatherTip(day: DailyForecast): string | null {
  if (THUNDER_CODES.has(day.weatherCode)) {
    return "Очікується гроза — по можливості лишайтеся в приміщенні";
  }
  if (SNOW_CODES.has(day.weatherCode)) {
    return "Сьогодні сніг — вдягніться тепліше і будьте обережні на дорозі";
  }
  if (RAIN_CODES.has(day.weatherCode) || day.precipitationProbability >= 50) {
    return "Сьогодні дощ — не забудьте парасольку";
  }
  if (day.windSpeedMax >= 40) {
    return "Сильний вітер — вдягніться тепліше";
  }
  if (day.tempMax >= 30) {
    return "Спекотно — пийте більше води й уникайте сонця опівдні";
  }
  if (day.tempMax <= 0) {
    return "Морозно — вдягніться якнайтепліше";
  }
  if (day.precipitationProbability >= 30) {
    return "Можливий дощ — візьміть парасольку про всяк випадок";
  }
  return null;
}
