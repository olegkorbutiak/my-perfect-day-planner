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
  'Поверни лише JSON-об\'єкт форми {"tasks": [{"title": "...", "date": "today", "time": "15:00"}], "actions": [], ' +
  '"route": null}. ' +
  '"title" — природна, змістовна назва задачі чи події зі збереженням контексту (з ким, де, що саме) з вхідного ' +
  'тексту — напр. "Зустріч з колегами", а не просто "Зустріч". Без слів на позначення дати/часу всередині, без нумерації. ' +
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
  "Слова типу \"додай задачу\", \"запиши\", \"нагадай\", \"створи\", \"створити\", \"зроби\", \"заплануй\" — це не " +
  "сама дія, а лише вказівка щось занотувати чи запланувати; НІКОЛИ не включай ці слова (в жодній формі) у title " +
  "і не замінюй ними реальну назву задачі. title має описувати ЩО саме відбувається чи що треба зробити, взяте з " +
  "решти тексту після цих слів, зі збереженням усього контексту (з ким/де/що) — напр. з тексту \"створи сьогодні " +
  "зустріч з колегами на 18:00\" title має бути \"Зустріч з колегами\", а НЕ \"Зустріч\" і НЕ \"Створити зустріч\". " +
  "Якщо після прибирання таких службових слів у тексті не залишилось жодної конкретної дії, використай як title " +
  "рештку введеного тексту буквально — ніколи не вигадуй сторонню задачу, якої немає у вхідному тексті. " +
  "Крім нових задач, текст може містити КОМАНДИ про вже ІСНУЮЧІ задачі — напр. «перенеси зустріч на завтра», " +
  "«скасуй купити хліб», «відміни зустріч з лікарем», «познач виконаним подзвонити мамі», «зустріч більше не " +
  "потрібна». Після тексту користувача, у розділі \"Існуючі задачі:\", наведено список у форматі " +
  "\"id: назва (дата час)\". Якщо команда явно стосується ОДНІЄЇ з цих задач за смислом назви — додай об'єкт " +
  "у масив \"actions\": {\"id\": \"<id саме з цього списку>\", \"type\": \"reschedule\"|\"cancel\"|\"complete\"|" +
  "\"uncomplete\"}. \"reschedule\" — перенести на нову дату/час (додатково вкажи \"date\" і \"time\" за тими ж " +
  "правилами, що й для нових задач). \"cancel\" — скасувати/видалити задачу. \"complete\" — позначити " +
  "виконаною. \"uncomplete\" — скасувати позначку виконано. " +
  "ДУЖЕ ВАЖЛИВО щодо збігу: порівнюй ЗМІСТ дії, а не окремі спільні слова. Наприклад, якщо в списку є " +
  "\"Зустріч з лікарем\", а команда \"скасуй зустріч з інопланетянами\" — це про зовсім іншу, вигадану подію, " +
  "яка не відповідає жодній реальній задачі зі списку, тому action додавати НЕ треба, навіть попри спільне " +
  "слово \"зустріч\". Додавай action лише тоді, коли впевнений, що команда описує САМЕ ту задачу зі списку " +
  "(збігається головний предмет дії — з ким/куди/що, а не лише один загальний іменник). Якщо сумніваєшся або " +
  "жодна задача явно не підходить — НЕ додавай action і НІКОЛИ не вигадуй id, якого немає у списку. Той самий " +
  "текст може одночасно містити і нову задачу, і команду про існуючу. Якщо команд про існуючі задачі немає — " +
  "\"actions\": []. " +
  "Окремо: текст може бути ПРОХАННЯМ ПРОКЛАСТИ МАРШРУТ/НАВІГАЦІЮ між місцями — напр. \"проклади маршрут " +
  "зі Львова до Стрия\", \"як доїхати з Києва в Одесу\", \"побудуй найшвидший маршрут до аеропорту\", \"навігація " +
  "до вокзалу\". Це НЕ задача і НЕ дія над існуючою задачею — у такому разі поверни \"tasks\": [] і " +
  "\"actions\": [], а \"route\" заповни об'єктом {\"stops\": [...]} — упорядкованим списком усіх точок " +
  "маршруту по порядку проїзду. Перший елемент — початкова точка: якщо вона явно вказана в тексті (напр. " +
  "\"зі Львова\"), напиши її назву; якщо не вказана (напр. просто \"проклади маршрут до Стрия\"), перший " +
  "елемент — null (тоді буде використано поточне місцезнаходження користувача). Усі наступні елементи — " +
  "кінцеві й проміжні точки, обов'язково рядками (не null), у порядку проїзду. Якщо текст описує МАРШРУТ " +
  "ЧЕРЕЗ КІЛЬКА МІСЦЬ ланцюжком — напр. \"проклади маршрут зі Львова до Стрия, зі Стрия до Одеси\" або " +
  "\"їдемо з Києва в Житомир, потім у Рівне\" — це ОДИН маршрут з кількома точками, тому поверни всі точки " +
  "в одному масиві по порядку {\"stops\": [\"Львів\", \"Стрий\", \"Одеса\"]}, а НЕ повторюй спільну точку " +
  "(\"Стрий\") двічі і не створюй окремих маршрутів. Кожну назву місця переведи у НАЗИВНИЙ відмінок " +
  "українською (напр. \"зі Львова\" → \"Львів\", \"до Стрия\" → \"Стрий\", \"в Одесу\" → \"Одеса\") — саме " +
  "так, як пишеться назва населеного пункту в довіднику, без прийменників і відмінкових закінчень, оскільки " +
  "за цим текстом шукатимуться географічні координати. Якщо в тексті немає прохання прокласти маршрут — " +
  "\"route\": null.";

const ABSOLUTE_DATE_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ACTION_TYPES = ["reschedule", "cancel", "complete", "uncomplete"] as const;

type ParsedTask = { title: string; date: string; time: string | null };
type ActionType = (typeof ACTION_TYPES)[number];
type ParsedAction = { id: string; type: ActionType; date: string; time: string | null };
type ExistingTask = { id: string; text: string; dueDate: string | null; dueTime: string | null };

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

function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && (ACTION_TYPES as readonly string[]).includes(value);
}

function formatExistingTasks(existingTasks: ExistingTask[]): string {
  if (existingTasks.length === 0) return "(немає)";
  return existingTasks
    .map((t) => {
      const when = t.dueDate ? `${t.dueDate}${t.dueTime ? " " + t.dueTime : ""}` : "без дати";
      return `${t.id}: ${t.text} (${when})`;
    })
    .join("\n");
}

type ParsedRoute = { stops: (string | null)[] };

function isParsedRouteShape(value: unknown): value is { stops: unknown } {
  return typeof value === "object" && value !== null;
}

type RequestResult = {
  tasks: ParsedTask[];
  actions: ParsedAction[];
  route: ParsedRoute | null;
  rateLimited: boolean;
};

async function requestTasks(
  apiKey: string,
  model: string,
  text: string,
  existingTasks: ExistingTask[],
): Promise<RequestResult> {
  const userMessage = `${text}\n\nІснуючі задачі:\n${formatExistingTasks(existingTasks)}`;

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
        { role: "user", content: userMessage },
      ],
    }),
  }).catch(() => null);

  const empty = { tasks: [], actions: [], route: null, rateLimited: false };
  if (!response) return empty;
  if (response.status === 429) return { ...empty, rateLimited: true };
  if (!response.ok) return empty;

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return empty;
  }

  const rawTasks = (parsed as { tasks?: unknown })?.tasks;
  const tasks = Array.isArray(rawTasks)
    ? rawTasks
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
        })
    : [];

  const validIds = new Set(existingTasks.map((t) => t.id));
  const rawActions = (parsed as { actions?: unknown })?.actions;
  const actions = Array.isArray(rawActions)
    ? rawActions
        .filter((a): a is { id: unknown; type: unknown; date?: unknown; time?: unknown } =>
          typeof a === "object" && a !== null,
        )
        .filter((a) => typeof a.id === "string" && validIds.has(a.id) && isActionType(a.type))
        .map((a) => {
          const type = a.type as ActionType;
          const date = type === "reschedule" && isParsedDate(a.date) ? (a.date as string) : "none";
          return {
            id: a.id as string,
            type,
            date,
            time: type === "reschedule" && isValidTime(a.time) ? (a.time as string) : null,
          };
        })
    : [];

  const rawRoute = (parsed as { route?: unknown })?.route;
  const rawStops = isParsedRouteShape(rawRoute) ? rawRoute.stops : null;
  let route: ParsedRoute | null = null;
  if (Array.isArray(rawStops) && rawStops.length >= 2) {
    const [first, ...rest] = rawStops;
    const firstOk = first === null || (typeof first === "string" && first.trim());
    const restOk = rest.every((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (firstOk && restOk) {
      route = {
        stops: [
          first === null ? null : sanitizeUkrainian((first as string).trim()),
          ...(rest as string[]).map((s) => sanitizeUkrainian(s.trim())),
        ],
      };
    }
  }

  return { tasks, actions, route, rateLimited: false };
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
  const existingTasks: ExistingTask[] = Array.isArray(body?.existingTasks)
    ? body.existingTasks
        .filter(
          (t: unknown): t is ExistingTask =>
            typeof t === "object" &&
            t !== null &&
            typeof (t as ExistingTask).id === "string" &&
            typeof (t as ExistingTask).text === "string",
        )
        .slice(0, 80)
    : [];

  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;

  let tasks: ParsedTask[] = [];
  let actions: ParsedAction[] = [];
  let route: ParsedRoute | null = null;
  let rateLimited = false;
  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS && tasks.length === 0 && actions.length === 0 && !route && !rateLimited;
    attempt++
  ) {
    const result = await requestTasks(apiKey, model, text, existingTasks);
    tasks = result.tasks;
    actions = result.actions;
    route = result.route;
    rateLimited = result.rateLimited;
  }

  if (tasks.length === 0 && actions.length === 0 && !route) {
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
    actions: actions
      .map((a) => {
        if (a.type === "reschedule") {
          const dueDate = toDueDate(a.date);
          if (!dueDate) return null;
          return { id: a.id, type: a.type, dueDate, dueTime: a.time };
        }
        return { id: a.id, type: a.type };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
    route,
  });
}
