"use client";

import { BookOpen, FlaskConical, Layers3, Lightbulb, Target } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useLab } from "./store";

/** Global search across ideas, research, competitors, findings, experiments and notes. */
export function SearchPalette() {
  const { searchOpen, setSearchOpen, state, data, go } = useLab();
  const open = (path: string) => {
    setSearchOpen(false);
    go(path);
  };
  const ideaTitle = (id: string | null) => (id ? data.ideaById.get(id)?.title ?? "" : "");

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen} title="Search the Lab" description="Ideas, research, competitors, findings and experiments">
      <CommandInput placeholder="Search ideas, research, competitors, findings, notes…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing matches yet.</CommandEmpty>
        <CommandGroup heading="Ideas">
          {data.ideas.map(i => (
            <CommandItem key={i.id} value={`idea ${i.title} ${i.category} ${i.description} ${i.personalFitAngle} ${i.howItEarns} ${i.notes} ${i.id}`}
              onSelect={() => open(`idea/${i.id}`)}>
              <Target className="text-muted-foreground" />
              <span className="truncate">{i.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{i.horizon}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {Boolean(state?.research.length) && (
          <CommandGroup heading="Research">
            {state?.research.map(r => (
              <CommandItem key={r.id} value={`research ${r.title} ${r.body} ${r.tags.join(" ")} ${r.kind} ${r.id}`}
                onSelect={() => open(r.ideaId ? `idea/${r.ideaId}/${r.area === "Market" ? "market" : "research"}` : "discovery/findings")}>
                <BookOpen className="text-muted-foreground" />
                <span className="truncate">{r.title}</span>
                <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{ideaTitle(r.ideaId)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Boolean(state?.competitors.length) && (
          <CommandGroup heading="Competitors">
            {state?.competitors.map(c => (
              <CommandItem key={c.id} value={`competitor ${c.name} ${c.positioning} ${c.notes} ${c.category} ${c.id}`} onSelect={() => open(`idea/${c.ideaId}/competition`)}>
                <Layers3 className="text-muted-foreground" />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{ideaTitle(c.ideaId)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Boolean(state?.findings.length) && (
          <CommandGroup heading="Findings">
            {state?.findings.map(f => (
              <CommandItem key={f.id} value={`finding ${f.title} ${f.body} ${f.evidence} ${f.id}`}
                onSelect={() => open(f.ideaId ? `idea/${f.ideaId}/research` : "discovery/findings")}>
                <Lightbulb className="text-muted-foreground" />
                <span className="truncate">{f.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{f.scope}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Boolean(state?.experiments.length) && (
          <CommandGroup heading="Experiments">
            {state?.experiments.map(e => (
              <CommandItem key={e.id} value={`experiment ${e.name} ${e.ideaLabel} ${e.hypothesis} ${e.learning} ${e.result} ${e.id}`}
                onSelect={() => open(e.ideaId ? `idea/${e.ideaId}/experiments` : "experiments")}>
                <FlaskConical className="text-muted-foreground" />
                <span className="truncate">{e.name || e.hypothesis || e.ideaLabel}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{e.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
