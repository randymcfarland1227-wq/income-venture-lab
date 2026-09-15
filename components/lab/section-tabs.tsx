"use client";

import { cn } from "@/lib/utils";
import { useLab } from "./store";

/** Sub-navigation inside a section. Each tab is a real URL, so back/forward and links work. */
export function SectionTabs({ base, tabs, active }: { base: string; tabs: Array<[string, string, number?]>; active: string }) {
  const { go } = useLab();
  return (
    <nav className="section-tabs" aria-label="Section views">
      {tabs.map(([key, label, count]) => (
        <button key={key} type="button" aria-current={active === key ? "page" : undefined}
          className={cn("section-tab", active === key && "active")} onClick={() => go(`${base}/${key}`)}>
          {label}
          {count !== undefined && <span className="section-tab-count">{count}</span>}
        </button>
      ))}
    </nav>
  );
}
