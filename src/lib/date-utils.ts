const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

const MONTHS_NOMINATIVE = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];

const WEEKDAYS_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "НД"];

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addDaysISO(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso);
  return toISODate(new Date(y, m - 1, d + days));
}

export function diffDaysISO(a: string, b: string): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  const millisPerDay = 24 * 60 * 60 * 1000;
  const at = new Date(pa.y, pa.m - 1, pa.d).getTime();
  const bt = new Date(pb.y, pb.m - 1, pb.d).getTime();
  return Math.round((at - bt) / millisPerDay);
}

export function formatDateLabel(iso: string, todayIso: string): string {
  const offset = diffDaysISO(iso, todayIso);
  if (offset === 0) return "Сьогодні";
  if (offset === 1) return "Завтра";
  if (offset === -1) return "Вчора";
  const { d, m } = parseISO(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} хв`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} год` : `${hours} год ${rest} хв`;
}

export function formatScheduleLabel(
  dueDate: string | null,
  dueTime: string | null,
  durationMinutes: number | null,
  todayIso: string,
): string | null {
  if (!dueDate) return null;
  const parts = [formatDateLabel(dueDate, todayIso)];
  if (dueTime) parts[0] += `, ${dueTime}`;
  const durationLabel = formatDuration(durationMinutes);
  if (durationLabel) parts.push(durationLabel);
  return parts.join(" · ");
}

/** Monday-based ISO week start for the given date. */
export function getWeekStartISO(iso: string): string {
  const { y, m, d } = parseISO(iso);
  const date = new Date(y, m - 1, d);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addDaysISO(iso, mondayOffset);
}

export function getWeekDays(weekStartIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartIso, i));
}

export function formatWeekdayShort(iso: string): string {
  const { y, m, d } = parseISO(iso);
  const weekday = new Date(y, m - 1, d).getDay();
  return WEEKDAYS_SHORT[weekday === 0 ? 6 : weekday - 1];
}

export function formatWeekRangeLabel(weekStartIso: string): string {
  const weekEndIso = addDaysISO(weekStartIso, 6);
  const start = parseISO(weekStartIso);
  const end = parseISO(weekEndIso);
  if (start.m === end.m) {
    return `${start.d}–${end.d} ${MONTHS[start.m - 1]}`;
  }
  return `${start.d} ${MONTHS[start.m - 1]} – ${end.d} ${MONTHS[end.m - 1]}`;
}

/** Minutes since midnight for a HH:MM string. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** First-of-month ISO date, `delta` months from the month of `iso`. */
export function addMonthsISO(iso: string, delta: number): string {
  const { y, m } = parseISO(iso);
  return toISODate(new Date(y, m - 1 + delta, 1));
}

export function isSameMonth(iso: string, refIso: string): boolean {
  const a = parseISO(iso);
  const b = parseISO(refIso);
  return a.y === b.y && a.m === b.m;
}

export function formatMonthLabel(iso: string): string {
  const { y, m } = parseISO(iso);
  return `${MONTHS_NOMINATIVE[m - 1]} ${y}`;
}

/** 42 ISO dates (6 Monday-start weeks) covering the month of `iso`, with
 * leading/trailing days from adjacent months to fill the grid. */
export function getMonthGridDays(iso: string): string[] {
  const { y, m } = parseISO(iso);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const gridStart = getWeekStartISO(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso).d;
}

const WEEKDAY_JS_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** The nearest ISO date (today included) matching the given English weekday key. */
export function getNextWeekdayISO(todayIso: string, weekdayKey: string): string | null {
  const target = WEEKDAY_JS_INDEX[weekdayKey];
  if (target === undefined) return null;
  const { y, m, d } = parseISO(todayIso);
  const todayJsDay = new Date(y, m - 1, d).getDay();
  const offset = (target - todayJsDay + 7) % 7;
  return addDaysISO(todayIso, offset);
}

/** The nearest ISO date (today included) matching an annual "MM-DD" calendar date. */
export function getNextAnnualDateISO(todayIso: string, monthDay: string): string | null {
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!match) return null;
  const year = parseISO(todayIso).y;
  const candidate = `${year}-${match[1]}-${match[2]}`;
  return candidate >= todayIso ? candidate : `${year + 1}-${match[1]}-${match[2]}`;
}
