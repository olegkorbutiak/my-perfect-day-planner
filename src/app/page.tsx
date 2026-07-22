"use client";

import { useState } from "react";
import { MicIcon } from "@/components/icons";
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
    flashSaved("Додано в Inbox");
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
      const data: { tasks: string[] } = await response.json();
      addTasks(data.tasks);
      setText("");
      setBaseText("");
      flashSaved(
        data.tasks.length === 1
          ? "Додано 1 задачу в Inbox"
          : `Додано ${data.tasks.length} задачі в Inbox`,
      );
    } catch {
      setParseError("Не вдалося розібрати текст. Спробуйте «Зберегти» без AI.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6">
        <p className="font-condensed text-xs font-bold uppercase tracking-wide text-brand-green">
          Занотувати
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Що в голові?"
          autoFocus
          className="h-full w-full resize-none bg-transparent pt-2 text-2xl leading-relaxed text-brand-text outline-none placeholder:text-neutral-300"
        />
      </div>

      <div className="flex flex-col items-center gap-3 px-5 pb-5">
        {savedMessage && (
          <p className="font-condensed text-sm font-bold uppercase tracking-wide text-brand-green">
            {savedMessage}
          </p>
        )}
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}

        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            onClick={handleMicClick}
            disabled={!isSupported}
            aria-pressed={isListening}
            aria-label={isListening ? "Зупинити диктування" : "Диктувати голосом"}
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-white transition disabled:opacity-30 ${
              isListening ? "animate-pulse bg-red-600" : "bg-brand-dark"
            }`}
          >
            <MicIcon className="h-7 w-7" />
          </button>

          <button
            type="button"
            onClick={handleParse}
            disabled={!text.trim() || isParsing}
            className="h-16 flex-1 rounded-md bg-brand-green font-condensed text-lg font-bold uppercase tracking-wide text-white transition active:bg-brand-green-strong disabled:opacity-30"
          >
            {isParsing ? "Розбираю…" : "Розібрати з AI"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || isParsing}
          className="font-condensed text-sm font-bold uppercase tracking-wide text-brand-muted underline underline-offset-2 disabled:opacity-30"
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
