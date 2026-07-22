import { NextResponse } from "next/server";

const DEFAULT_MODEL = "nvidia/nemotron-nano-9b-v2:free";
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT =
  "Ти розбираєш нотатку користувача українською мовою на окремі конкретні задачі. " +
  'Поверни лише JSON-об\'єкт форми {"tasks": ["...", "..."]} — короткі формулювання задач у наказовому стилі, ' +
  "без нумерації, дат чи пояснень. Якщо в тексті лише одна задача — поверни масив з одним елементом. " +
  "ВАЖЛИВО: усі задачі в масиві мають бути написані українською мовою — тією ж мовою, що й вхідний текст. " +
  "Не перекладай і не переписуй англійською.";

async function requestTasks(apiKey: string, model: string, text: string): Promise<string[]> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const tasks = (parsed as { tasks?: unknown })?.tasks;
  if (!Array.isArray(tasks)) return [];

  return tasks.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim());
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY не налаштований на сервері" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Порожній текст" }, { status: 400 });
  }

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  let tasks: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && tasks.length === 0; attempt++) {
    tasks = await requestTasks(apiKey, model, text);
  }

  if (tasks.length === 0) {
    return NextResponse.json({ error: "AI не зміг розпізнати задачі" }, { status: 502 });
  }

  return NextResponse.json({ tasks });
}
