"use client";

import { Film, Newspaper } from "lucide-react";

export type Tab = "releases" | "news";

export default function TabNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "news", label: "Novinky", icon: <Newspaper className="w-4 h-4" /> },
    { id: "releases", label: "Nové filmy", icon: <Film className="w-4 h-4" /> },
  ];

  return (
    <div className="grid w-full grid-cols-2 border-b border-[color:var(--line)] sm:w-auto sm:min-w-[22rem]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex min-h-11 items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors sm:px-4 ${
            active === t.id
              ? "border-[color:var(--foreground)] font-semibold text-[color:var(--foreground)]"
              : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
