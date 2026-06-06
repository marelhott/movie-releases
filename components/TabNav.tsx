"use client";

import { Film, Newspaper, BrainCircuit, Cpu } from "lucide-react";

export type Tab = "releases" | "news" | "ai" | "tech";

export default function TabNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "news", label: "Film", icon: <Newspaper className="w-4 h-4" /> },
    { id: "releases", label: "Nové filmy", icon: <Film className="w-4 h-4" /> },
    { id: "ai", label: "AI", icon: <BrainCircuit className="w-4 h-4" /> },
    { id: "tech", label: "Technologie", icon: <Cpu className="w-4 h-4" /> },
  ];

  return (
    <div className="grid w-full grid-cols-4 border-b border-[color:var(--line)] sm:w-auto sm:flex">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex min-h-11 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors sm:px-4 ${
            active === t.id
              ? "border-[color:var(--foreground)] font-semibold text-[color:var(--foreground)]"
              : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          }`}
        >
          {t.icon}
          <span className="hidden sm:inline">{t.label}</span>
          <span className="sm:hidden text-xs">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
