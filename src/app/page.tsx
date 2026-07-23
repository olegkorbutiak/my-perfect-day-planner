"use client";

import { useState } from "react";
import { CheckIcon, MicIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { InspirationQuote } from "@/components/inspiration-quote";
import { useTasks } from "@/lib/tasks-context";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";

export default function CapturePage() {
  const { addTask, addTasks } = useTasks();
  const [text, setText] = useState("");
  const [baseText, setBaseText] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");

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

  const handleParse = async () => {
    if (!text.trim() || isParsing) return;
    setIsParsing(true);
    setParseError("");
    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error();
      const data: {
        tasks: { title: string; dueDate: string | null; dueTime: string | null }[];
      } = await response.json();
      addTasks(
        data.tasks.map((t) => ({ text: t.title, dueDate: t.dueDate, dueTime: t.dueTime })),
      );
      setText("");
      setBaseText("");
      const scheduledCount = data.tasks.filter((t) => t.dueDate !== null).length;
      const message =
        data.tasks.length === 1 ? "Додано 1 задачу" : `Додано ${data.tasks.length} задачі`;
      flashSaved(
        scheduledCount > 0 ? `${message} (${scheduledCount} — у календарі)` : `${message} у Вхідні`,
      );
    } catch {
      setParseError("Не вдалося розібрати текст. Спробуйте «Зберегти» без AI.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pt-6">
        <Logo className="animate-fade-up pb-4" />
        <p className="animate-fade-up font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
          Занотувати
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Що на думці, господарю?"
          className="h-full w-full resize-none bg-transparent pt-2 text-2xl leading-relaxed text-brand-text outline-none transition-colors placeholder:text-neutral-300 selection:bg-brand-green/20 caret-brand-green"
        />
        {!text.trim() && (
          <div className="pointer-events-none absolute inset-x-5 bottom-4 animate-fade-up">
            <InspirationQuote />
          </div>
        )}
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
