"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, MicIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { AccountButton } from "@/components/account-button";
import { useTasks } from "@/lib/tasks-context";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { buildRouteSearchParams } from "@/lib/route-url";

function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 32;
  el.style.height = `${Math.max(el.scrollHeight, lineHeight * 3)}px`;
}

type ActionType = "reschedule" | "cancel" | "complete" | "uncomplete";
type ParsedAction = {
  id: string;
  type: ActionType;
  dueDate?: string | null;
  dueTime?: string | null;
};

export default function CapturePage() {
  const router = useRouter();
  const { tasks, addTask, addTasks, rescheduleTask, removeTask, toggleDone } = useTasks();
  const [text, setText] = useState("");
  const [baseText, setBaseText] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    autoResizeTextarea(textareaRef.current);
  }, [text]);

  const { isListening, isSupported, toggle } = useSpeechRecognition((transcript) => {
    setText(baseText ? `${baseText} ${transcript}`.trim() : transcript);
  });

  const handleMicClick = () => {
    if (!isListening) setBaseText(text);
    toggle();
  };

  const flashSaved = (message: string) => {
    setSavedMessage(message);
    setTimeout(() => setSavedMessage(""), 1500);
  };

  const handleSave = () => {
    if (!text.trim()) return;
    addTask(text);
    setText("");
    setBaseText("");
    flashSaved("Додано у Вхідні");
  };

  const applyAction = (action: ParsedAction) => {
    const target = tasks.find((t) => t.id === action.id);
    if (!target) return false;
    if (action.type === "reschedule") {
      rescheduleTask(action.id, action.dueDate ?? null, action.dueTime ?? null);
    } else if (action.type === "cancel") {
      removeTask(action.id);
    } else if (action.type === "complete") {
      if (!target.done) toggleDone(action.id);
    } else if (action.type === "uncomplete") {
      if (target.done) toggleDone(action.id);
    }
    return true;
  };

  const handleParse = async () => {
    if (!text.trim() || isParsing) return;
    setIsParsing(true);
    setParseError("");
    try {
      const existingTasks = tasks
        .filter((t) => !t.archived)
        .map((t) => ({ id: t.id, text: t.text, dueDate: t.dueDate, dueTime: t.dueTime }));

      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, existingTasks }),
      });
      const data: {
        tasks?: { title: string; dueDate: string | null; dueTime: string | null }[];
        actions?: ParsedAction[];
        route?: { stops: (string | null)[] } | null;
        error?: string;
      } = await response.json();
      if (!response.ok || (!data.tasks && !data.actions && !data.route)) {
        throw new Error(data.error);
      }

      if (data.route) {
        setText("");
        setBaseText("");
        const params = buildRouteSearchParams(
          data.route.stops.map((name) => ({ text: name ?? "" })),
        );
        router.push(`/navigation?${params.toString()}`);
        return;
      }

      const newTasks = data.tasks ?? [];
      const newActions = data.actions ?? [];

      if (newTasks.length > 0) {
        addTasks(newTasks.map((t) => ({ text: t.title, dueDate: t.dueDate, dueTime: t.dueTime })));
      }
      const appliedActions = newActions.filter(applyAction);

      setText("");
      setBaseText("");

      const parts: string[] = [];
      if (newTasks.length > 0) {
        const scheduledCount = newTasks.filter((t) => t.dueDate !== null).length;
        const label = newTasks.length === 1 ? "додано 1 задачу" : `додано ${newTasks.length} задачі`;
        parts.push(scheduledCount > 0 ? `${label} (${scheduledCount} — у календарі)` : label);
      }
      const rescheduled = appliedActions.filter((a) => a.type === "reschedule").length;
      const cancelled = appliedActions.filter((a) => a.type === "cancel").length;
      const completed = appliedActions.filter(
        (a) => a.type === "complete" || a.type === "uncomplete",
      ).length;
      if (rescheduled > 0) parts.push(`перенесено ${rescheduled}`);
      if (cancelled > 0) parts.push(`скасовано ${cancelled}`);
      if (completed > 0) parts.push(`позначено ${completed}`);

      flashSaved(parts.length > 0 ? parts.join(", ") : "Готово");
    } catch (err) {
      setParseError(
        err instanceof Error && err.message
          ? err.message
          : "Не вдалося розібрати текст. Спробуйте «Зберегти» без AI.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-6">
        <div className="flex animate-fade-up items-start justify-between pb-4">
          <Logo />
          <AccountButton />
        </div>
        <p className="animate-fade-up font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
          Занотувати
        </p>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Що на думці, господарю?"
          className="mt-2 w-full resize-none bg-transparent text-2xl leading-relaxed text-brand-text outline-none transition-colors placeholder:text-neutral-300 selection:bg-brand-green/20 caret-brand-green"
        />
      </div>

      <div className="flex flex-col items-center gap-3 px-5 pb-5">
        {savedMessage && (
          <p className="flex animate-pop items-center gap-1.5 font-condensed text-sm font-bold uppercase tracking-wide text-brand-green">
            <CheckIcon className="h-4 w-4" />
            {savedMessage}
          </p>
        )}
        {parseError && <p className="animate-fade-up text-sm text-red-600">{parseError}</p>}

        <div className="flex w-full items-center gap-3">
          <div className="relative shrink-0">
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-md bg-red-500/40 animate-ping" />
                <span
                  className="absolute inset-0 rounded-md bg-red-500/30 animate-ping"
                  style={{ animationDelay: "0.3s" }}
                />
              </>
            )}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!isSupported}
              aria-pressed={isListening}
              aria-label={isListening ? "Зупинити диктування" : "Диктувати голосом"}
              className={`relative flex h-16 w-16 items-center justify-center rounded-md text-white transition-all duration-200 active:scale-90 disabled:opacity-30 ${
                isListening ? "scale-105 bg-red-600" : "bg-brand-dark animate-breathe"
              }`}
            >
              <MicIcon className="h-7 w-7" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleParse}
            disabled={!text.trim() || isParsing}
            className={`relative flex h-16 flex-1 items-center justify-center overflow-hidden rounded-md text-center font-condensed text-lg font-bold uppercase tracking-wide text-white transition-all duration-200 active:scale-[0.98] active:bg-brand-green-strong disabled:opacity-30 ${
              text.trim() && !isParsing ? "shadow-glow" : ""
            } ${
              isParsing
                ? "bg-[linear-gradient(110deg,var(--color-brand-green-strong)_35%,var(--color-brand-green)_50%,var(--color-brand-green-strong)_65%)] bg-[length:200%_100%] animate-shimmer"
                : "bg-brand-green"
            }`}
          >
            {isParsing ? "Розбираю…" : "Розібрати з AI"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || isParsing}
          className="text-center font-condensed text-sm font-bold uppercase tracking-wide text-brand-muted underline underline-offset-2 transition active:scale-95 disabled:opacity-30"
        >
          Зберегти без AI
        </button>

        {!isSupported && (
          <p className="text-center text-xs text-brand-muted">
            Диктування голосом не підтримується в цьому браузері — можна просто писати текст.
          </p>
        )}
      </div>
    </div>
  );
}
