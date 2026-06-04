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
    <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === t.id
              ? "bg-zinc-700 text-white shadow"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
