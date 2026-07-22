const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

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

export function formatScheduleLabel(
  dueDate: string | null,
  dueTime: string | null,
  todayIso: string,
): string | null {
  if (!dueDate) return null;
  const dateLabel = formatDateLabel(dueDate, todayIso);
  return dueTime ? `${dateLabel}, ${dueTime}` : dateLabel;
}
