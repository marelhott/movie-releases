"use client";

import { useEffect, useState } from "react";
import TabNav, { Tab } from "./TabNav";
import MovieGrid from "./MovieGrid";
import NewsTab from "./NewsTab";
import FeedTab from "./FeedTab";

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("ai");
  const [visited, setVisited] = useState<Record<Tab, boolean>>({
    ai: true, tech: false, news: false, releases: false,
  });

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
      <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:var(--background)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-6 px-4 sm:px-6">
          <span
            className="flex-shrink-0 text-[0.9375rem] font-semibold tracking-[-0.02em] text-[color:var(--foreground)]"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            Release
          </span>
          <TabNav active={tab} onChange={setTab} />
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:py-8">
        <section className={tab === "news" ? "block" : "hidden"}>
          <NewsTab />
        </section>
        {visited.releases && (
          <section className={tab === "releases" ? "block" : "hidden"}>
            <MovieGrid />
          </section>
        )}
        {visited.ai && (
          <section className={tab === "ai" ? "block" : "hidden"}>
            <FeedTab category="ai" />
          </section>
        )}
        {visited.tech && (
          <section className={tab === "tech" ? "block" : "hidden"}>
            <FeedTab category="tech" />
          </section>
        )}
      </div>
    </>
  );
}
