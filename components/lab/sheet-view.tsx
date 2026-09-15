"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/domain";
import { TABS, WORKBOOKS, type TabKey } from "@/lib/sync/tabs";
import { OpenInSheet } from "./sheet-link";
import { HEALTH_LABEL, SyncDot, useSyncHealth } from "./shell";
import { useLab } from "./store";
import { Tag } from "./ui";

/** Which Sheet tabs back this section, how many rows are linked, and how columns map. */
export function SheetView({ tabs }: { tabs: TabKey[] }) {
  const { state, syncNow, syncing, go } = useLab();
  const health = useSyncHealth();
  const linked = (key: TabKey) => Object.values(state?.sheetRows ?? {}).filter(list => list.some(r => r.tab === key)).length;

  return (
    <div className="grid gap-5">
      <div className="sheet-status">
        <div className="flex items-center gap-3">
          <SyncDot health={health} />
          <div>
            <p className="font-semibold">{HEALTH_LABEL[health]}</p>
            <p className="text-sm text-muted-foreground">
              {state?.sync.lastSuccessAt ? `Last successful sync ${relativeTime(state.sync.lastSuccessAt)}` : "Not synced with Google Sheets yet"}
              {state?.sync.lastError && health !== "synced" ? ` · ${state.sync.lastError}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => go("sync")}>Sync Activity</Button>
          <Button className="rounded-full" onClick={() => void syncNow()} disabled={syncing || !state?.sync.configured}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> Sync Now
          </Button>
        </div>
      </div>
      <div className="sheet-grid">
        {tabs.map(key => {
          const tab = TABS[key];
          const where = state?.sync.sheets[key];
          return (
            <section key={key} className="panel">
              <p className="card-kicker">{WORKBOOKS[tab.workbook].short}</p>
              <h3 className="panel-title">{where?.sheetName ?? tab.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{linked(key)} rows linked by <code>_sync_id</code></p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tab.fields.map(f => (
                  <Tag key={f.header} className={f.readOnly ? "tag-calculated" : undefined}>
                    {f.label}{f.readOnly ? " · calculated" : ""}
                  </Tag>
                ))}
              </div>
              <OpenInSheet tab={key} className="mt-5 rounded-full" />
            </section>
          );
        })}
      </div>
    </div>
  );
}
