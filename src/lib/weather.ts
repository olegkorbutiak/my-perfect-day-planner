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
