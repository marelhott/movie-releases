"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import TabNav, { Tab } from "./TabNav";
import MovieGrid from "./MovieGrid";
import NewsTab from "./NewsTab";

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("news");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-emerald-500/10">
              <Film className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-base font-bold">Movie Releases</span>
          </div>
          <TabNav active={tab} onChange={setTab} />
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        {tab === "releases" && <MovieGrid />}
        {tab === "news" && <NewsTab />}
      </div>
    </>
  );
}
