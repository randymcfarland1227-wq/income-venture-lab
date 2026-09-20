"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HORIZONS, INCOME_STYLES, OPPORTUNITY_TYPES, VENTURE_TRACKS } from "@/lib/domain";
import { useLab } from "./store";

const DESTINATIONS = ["Income Pipeline", ...VENTURE_TRACKS] as const;
const EMPTY = { title: "", destination: "Income Pipeline", horizon: "Short Term", incomeStyle: "Active", opportunityType: "Service Business", category: "", description: "" };

const HORIZON_HINT: Record<string, string> = {
  "Short Term": "Adds a row to Income Ideas in the short-term workbook.",
  "Long Term": "Adds a row to Income Options in the long-term workbook.",
  "Both": "One idea, represented in both workbooks.",
};

/** Lightweight capture: six fields, everything else waits in the workspace. */
export function AddIdeaDialog() {
  const { addIdeaOpen, setAddIdeaOpen, create, go, data, route } = useLab();
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const setOpen = (open: boolean) => {
    setAddIdeaOpen(open);
    if (!open) setDraft(EMPTY);
  };

  const categories = useMemo(() => [...new Set(data.ideas.map(i => i.category).filter(Boolean))].sort(), [data.ideas]);
  const set = (key: keyof typeof EMPTY, value: string) => setDraft(d => ({ ...d, [key]: value }));

  useEffect(() => {
    if (addIdeaOpen && route.page === "ventures" && !draft.title) {
      setDraft(d => ({ ...d, destination: route.sub === "vault" ? "Idea Vault" : "Venture Studio", horizon: "Long Term" }));
    }
  }, [addIdeaOpen, route.page, route.sub, draft.title]);

  // Let an assistant embedded in the browser create ideas, when the page offers that API.
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: unknown) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_income_idea",
      title: "Create income idea",
      description: "Create a new idea in Income & Venture Lab and open its workspace.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" }, destination: { type: "string", enum: [...DESTINATIONS] }, horizon: { type: "string", enum: [...HORIZONS] }, incomeStyle: { type: "string", enum: [...INCOME_STYLES] },
          opportunityType: { type: "string" }, category: { type: "string" }, description: { type: "string" },
        },
        required: ["title", "horizon", "incomeStyle", "opportunityType"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: Record<string, string>) => {
        const { destination, ...idea } = input;
        const id = await create("ideas", { ...idea, ventureTrack: destination && destination !== "Income Pipeline" ? destination : null, category: input.category || input.opportunityType });
        if (id) go(`idea/${id}`);
        return { id };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [create, go]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    const { destination, ...idea } = draft;
    const id = await create("ideas", { ...idea, ventureTrack: destination === "Income Pipeline" ? null : destination, category: draft.category.trim() || draft.opportunityType });
    setBusy(false);
    if (id) {
      setOpen(false);
      go(`idea/${id}`);
    }
  };

  return (
    <Dialog open={addIdeaOpen} onOpenChange={setOpen}>
      <DialogContent className="add-idea-dialog">
        <form onSubmit={submit}>
          <div className="add-idea-head">
            <DialogHeader>
              <DialogTitle className="font-display text-3xl">Capture an Idea</DialogTitle>
              <DialogDescription className="text-white/65">Start light. The deeper workspace will be waiting when you need it.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-5 px-7 py-6">
            <div className="grid gap-2">
              <Label htmlFor="idea-title">Idea Name</Label>
              <Input id="idea-title" autoFocus value={draft.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Wedding venue" className="h-11" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="idea-destination">Where Should This Live?</Label>
              <select id="idea-destination" value={draft.destination} onChange={e => set("destination", e.target.value)}>
                {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
              </select>
              <span className="form-hint">{draft.destination === "Venture Studio" ? "For a business you are actively developing, with planning, brand, and marketing tools." : draft.destination === "Idea Vault" ? "For a concept worth keeping and exploring without putting it into the income pipeline." : "Syncs with the Short-Term or Long-Term income workbook."}</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {draft.destination === "Income Pipeline" && <div className="grid gap-2">
                <Label htmlFor="idea-horizon">Horizon</Label>
                <select id="idea-horizon" value={draft.horizon} onChange={e => set("horizon", e.target.value)}>
                  {HORIZONS.map(h => <option key={h}>{h}</option>)}
                </select>
                <span className="form-hint">{HORIZON_HINT[draft.horizon]}</span>
              </div>}
              <div className="grid gap-2">
                <Label htmlFor="idea-style">Income Style</Label>
                <select id="idea-style" value={draft.incomeStyle} onChange={e => set("incomeStyle", e.target.value)}>
                  {INCOME_STYLES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idea-type">Opportunity Type</Label>
                <select id="idea-type" value={draft.opportunityType} onChange={e => set("opportunityType", e.target.value)}>
                  {OPPORTUNITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idea-category">Category</Label>
                <Input id="idea-category" list="idea-categories" value={draft.category} onChange={e => set("category", e.target.value)} placeholder="e.g. Events" className="h-11" />
                <datalist id="idea-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="idea-description">Why Is This Interesting?</Label>
              <Textarea id="idea-description" value={draft.description} onChange={e => set("description", e.target.value)} placeholder="A sentence or two is enough for now." rows={3} />
            </div>
          </div>
          <DialogFooter className="border-t px-7 py-5">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !draft.title.trim()} className="rounded-full px-5">Create Workspace <ArrowUpRight /></Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
