import { LinkIcon } from "./icons";

export function InspirationQuote() {
  return (
    <div className="mx-auto max-w-xs rounded-2xl bg-brand-dark px-5 py-4 text-center shadow-card-hover">
      <p className="text-[15px] leading-relaxed text-white/90">
        «Життя — це те, що з тобою відбувається, поки ти будуєш плани».
      </p>
      <p className="mt-2 flex items-center justify-center gap-1.5 font-condensed text-sm font-bold uppercase tracking-wide text-brand-green">
        — Джон Леннон
        <LinkIcon className="h-3.5 w-3.5 opacity-60" />
      </p>
    </div>
  );
}
