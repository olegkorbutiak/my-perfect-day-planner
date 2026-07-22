"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, InboxIcon, MicIcon } from "./icons";

const TABS = [
  { href: "/", label: "Занотувати", Icon: MicIcon },
  { href: "/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/calendar", label: "Календар", Icon: CalendarIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.href === pathname));

  return (
    <nav
      className="relative shrink-0 border-t border-white/5 bg-brand-dark/90 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <span
        className="absolute top-2 bottom-2 left-0 w-1/3 rounded-xl bg-white/[0.06] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      <div className="relative flex">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-3 font-condensed text-xs font-bold uppercase tracking-wide transition-all duration-200 active:scale-90 ${
                isActive ? "text-brand-green" : "text-white/40"
              }`}
            >
              <Icon
                className={`h-7 w-7 transition-transform duration-300 ${isActive ? "-translate-y-0.5 scale-110" : ""}`}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
