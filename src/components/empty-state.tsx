import type { ComponentType, SVGProps } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center animate-fade-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-dark/[0.06] text-brand-dark/40">
        <Icon className="h-8 w-8" strokeWidth={1.75} />
      </div>
      <p className="font-condensed text-lg font-bold uppercase tracking-wide text-brand-text">
        {title}
      </p>
      <p className="text-sm text-brand-muted">{description}</p>
    </div>
  );
}
