import { NextResponse } from "next/server";
import { addDaysISO, getNextAnnualDateISO, getNextWeekdayISO, todayISO } from "@/lib/date-utils";
import { sanitizeUkrainian } from "@/lib/uk-sanitize";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 12000;

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const SYSTEM_PROMPT =
  "Ти розбираєш нотатку користувача українською мовою на окремі конкретні задачі, визначаючи для кожної дату й час. " +
  'Поверни лише JSON-об\'єкт форми {"tasks": [{"title": "...", "date": "today", "time": "15:00"}]}. ' +
  '"title" — коротке формулювання задачі у наказовому стилі, без слів на позначення дати/часу всередині, без нумерації. ' +
  '"date" — одне з: "today" (сьогодні), "tomorrow" (завтра), "day_after_tomorrow" (післязавтра), ' +
  '"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" (якщо згадано конкретний день тижня — ' +
  'напр. "у п\'ятницю", "в неділю"), рядок у форматі "MM-DD" (лише місяць і день, без року), якщо вказано конкретне ' +
  'календарне число (напр. "26 липня" → "07-26", "1 січня" → "01-01", "26.07" → "07-26") — рік визначати не потрібно, ' +
  'система сама підставить найближчий відповідний рік, або "none" (якщо дату взагалі не вказано). ' +
  '"time" — час у форматі "ГГ:ХХ" (24-годинний), якщо в тексті прямо вказано час (напр. "о 15:00", "о 9 ранку" → "09:00"), ' +
  'або приблизний час за словом дня: "вранці"/"зранку" → "09:00", "вдень" → "13:00", "ввечері" → "19:00", "вночі" → "22:00". ' +
  'Слова "цілий день"/"весь день"/"на весь день" НЕ є часом дня — якщо подія на цілий день, "time" завжди null. ' +
  'Якщо часу немає в тексті — "time": null. Якщо "date" дорівнює "none", то "time" теж завжди null. ' +
  "КРИТИЧНО ВАЖЛИВО: не вигадуй жодних дій, яких немає в тексті користувача. Кожна задача має відповідати " +
  "конкретній дії, згаданій у вхідному тексті — нічого не додавай і не змінюй суть. " +
  "Усі назви задач пиши українською мовою — тією ж, що й вхідний текст, без перекладу. " +
  "УВАГА: якщо в тексті згадано кілька РІЗНИХ днів тижня для різних задач — уважно прив'язуй кожну дату саме до " +
  "тієї задачі, біля якої вона стоїть у реченні. Не переноси день тижня однієї задачі на іншу. " +
  "Пиши виключно грамотною літературною українською мовою: без жодних російських слів, без кальок з російської " +
  "(напр. \"сьогодні\" не \"сегодня\", \"зробити\" не \"сделать\", \"дякую\" не \"спасибо\") і без латинської транслітерації " +
  "українських слів. " +
  "Слова типу \"додай задачу\", \"запиши\", \"нагадай\" — це не сама задача, а лише вказівка щось занотувати; " +
  "title має описувати ЩО саме робити, взяте з решти тексту після цих слів. Якщо після прибирання таких " +
  "службових слів у тексті не залишилось жодної конкретної дії, використай як title рештку введеного тексту " +
  "буквально — ніколи не вигадуй сторонню задачу, якої немає у вхідному тексті.";

const ABSOLUTE_DATE_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

type ParsedTask = { title: string; date: string; time: string | null };

function isParsedDate(value: unknown): value is string {
  return (
    value === "today" ||
    value === "tomorrow" ||
    value === "day_after_tomorrow" ||
    value === "none" ||
    (typeof value === "string" &&
      ((WEEKDAY_KEYS as readonly string[]).includes(value) || ABSOLUTE_DATE_PATTERN.test(value)))
  );
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

type RequestResult = { tasks: ParsedTask[]; rateLimited: boolean };

async function requestTasks(apiKey: string, model: string, text: string): Promise<RequestResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
  }).catch(() => null);

  if (!response) return { tasks: [], rateLimited: false };
  if (response.status === 429) return { tasks: [], rateLimited: true };
  if (!response.ok) return { tasks: [], rateLimited: false };

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { tasks: [], rateLimited: false };
  }

  const tasks = (parsed as { tasks?: unknown })?.tasks;
  if (!Array.isArray(tasks)) return { tasks: [], rateLimited: false };

  return {
    tasks: tasks
      .filter((t): t is { title: unknown; date: unknown; time: unknown } =>
        typeof t === "object" && t !== null,
      )
      .filter((t) => typeof t.title === "string" && t.title.trim())
      .map((t) => {
        const date = isParsedDate(t.date) ? t.date : "none";
        return {
          title: sanitizeUkrainian((t.title as string).trim()),
          date,
          time: date !== "none" && isValidTime(t.time) ? t.time : null,
        };
      }),
    rateLimited: false,
  };
}

function toDueDate(date: string): string | null {
  const today = todayISO();
  if (date === "today") return today;
  if (date === "tomorrow") return addDaysISO(today, 1);
  if (date === "day_after_tomorrow") return addDaysISO(today, 2);
  if ((WEEKDAY_KEYS as readonly string[]).includes(date)) {
    return getNextWeekdayISO(today, date);
  }
  if (ABSOLUTE_DATE_PATTERN.test(date)) {
    return getNextAnnualDateISO(today, date);
  }
  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY не налаштований на сервері" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Порожній текст" }, { status: 400 });
  }

  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;

  let tasks: ParsedTask[] = [];
  let rateLimited = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && tasks.length === 0 && !rateLimited; attempt++) {
    const result = await requestTasks(apiKey, model, text);
    tasks = result.tasks;
    rateLimited = result.rateLimited;
  }

  if (tasks.length === 0) {
    const error = rateLimited
      ? "Перевищено денний ліміт безкоштовних AI-запитів. Спробуйте пізніше або скористайтеся «Зберегти без AI»."
      : "AI не зміг розпізнати задачі";
    return NextResponse.json({ error }, { status: rateLimited ? 429 : 502 });
  }

  return NextResponse.json({
    tasks: tasks.map((t) => {
      const dueDate = toDueDate(t.date);
      return { title: t.title, dueDate, dueTime: dueDate ? t.time : null };
    }),
  });
}
