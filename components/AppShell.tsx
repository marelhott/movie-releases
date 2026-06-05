"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import TabNav, { Tab } from "./TabNav";
import MovieGrid from "./MovieGrid";
import NewsTab from "./NewsTab";

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("news");
  const [visited, setVisited] = useState<Record<Tab, boolean>>({ news: true, releases: false });

  useEffect(() => {
    setVisited((current) => (current[tab] ? current : { ...current, [tab]: true }));
  }, [tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisited((current) => (current.releases ? current : { ...current, releases: true }));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:rgba(255,253,248,0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[color:var(--accent-soft)] p-1.5">
              <Film className="h-5 w-5 text-[color:var(--accent)]" />
            </div>
            <span className="text-base font-bold text-[color:var(--foreground)]">Movie Releases</span>
          </div>
          <TabNav active={tab} onChange={setTab} />
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        <section className={tab === "news" ? "block" : "hidden"}>
          <NewsTab />
        </section>
        {visited.releases && (
          <section className={tab === "releases" ? "block" : "hidden"}>
            <MovieGrid />
          </section>
        )}
      </div>
    </>
  );
}
