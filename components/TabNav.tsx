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
    <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] p-1 shadow-sm sm:w-auto sm:flex">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:px-4 ${
            active === t.id
              ? "bg-[color:var(--accent)] text-white shadow"
              : "text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
