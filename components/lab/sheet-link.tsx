"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TABS, workbookUrl, type TabKey } from "@/lib/sync/tabs";
import { useLab } from "./store";

/** "Open in Google Sheet" — deep-links to the tab (and row) when the sync knows where it is. */
export function OpenInSheet({ tab, row, label, variant = "outline", className }: {
  tab: TabKey | "guardrails";
  row?: number | null;
  label?: string;
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const { state } = useLab();
  const where = state?.sync.sheets[tab];
  const workbook = tab === "guardrails" ? "long" : TABS[tab].workbook;
  const href = workbookUrl(workbook, where?.gid ?? null, row ?? null);
  return (
    <Button asChild variant={variant} className={className ?? "rounded-full"}>
      <a href={href} target="_blank" rel="noreferrer">
        {label ?? "Open in Google Sheet"} <ExternalLink />
      </a>
    </Button>
  );
}
