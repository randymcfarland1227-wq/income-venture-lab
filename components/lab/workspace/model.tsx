"use client";

import { Blocks, Hammer, ShieldAlert } from "lucide-react";
import { BARRIER_TYPES, money, num, type Barrier, type Idea } from "@/lib/domain";
import { incomePerMaintenanceHour } from "../library-defs";
import { useLab } from "../store";
import { Editable, Stat } from "../ui";
import { DetailField, ModuleIntro, useIdeaSave } from "./common";

export function ModelModule({ idea }: { idea: Idea }) {
  const save = useIdeaSave(idea);
  return (
    <>
      <ModuleIntro icon={Blocks} title="Business Model" description="How value is delivered and how money comes back. Keep it plain — this is not a canvas exercise." />
      <div className="detail-grid three">
        <DetailField idea={idea} detail="revenueStreams" label="Revenue Streams" placeholder="What people pay for" />
        <DetailField idea={idea} detail="pricingModel" label="Pricing Model" placeholder="Per project, hourly, subscription, per unit…" />
        <DetailField idea={idea} detail="recurring" label="Recurring vs One-Time" placeholder="How much of revenue repeats?" />
        <DetailField idea={idea} detail="acquisition" label="Customer Acquisition" placeholder="How the first 10 customers find you" />
        <DetailField idea={idea} detail="delivery" label="Delivery Model" placeholder="How the work or product reaches the customer" />
        <DetailField idea={idea} detail="partners" label="Partner / Vendor Needs" />
        <DetailField idea={idea} detail="keyResources" label="Key Resources" placeholder="Skills, tools, assets, capital" />
        <DetailField idea={idea} detail="keyActivities" label="Key Activities" placeholder="What you do every week to earn" />
        <div className="detail-field">
          <Editable label="Income Model (Workbook)" value={idea.incomeModel} onSave={save.field("incomeModel")} placeholder="e.g. Project / retainer" />
        </div>
      </div>
    </>
  );
}

export function BuildModule({ idea }: { idea: Idea }) {
  const { data } = useLab();
  const save = useIdeaSave(idea);
  const actuals = data.actuals.get(idea.id);
  const perHour = incomePerMaintenanceHour(idea, actuals);
  return (
    <>
      <ModuleIntro icon={Hammer} title="Build & Maintenance" description="Passive-ish income still costs effort: once to build, and every week to keep it running." />
      <div className="stat-strip mb-6">
        <Stat label="Build Effort" value={idea.setupEffort ? `${idea.setupEffort} / 5` : "—"} note="Setup effort" />
        <Stat label="Maintenance Effort" value={idea.ongoingEffort ? `${idea.ongoingEffort} / 5` : "—"} note={idea.maintenanceHours ? `${num(idea.maintenanceHours)} hrs/week` : "Hours not set"} />
        <Stat label="Passive Potential" value={idea.passivePotential ? `${idea.passivePotential} / 5` : "—"} />
        <Stat label="Income per Maintenance Hour" value={perHour === null ? "—" : money(perHour)} note={perHour === null ? "Needs actual income + maintenance hours" : "Actual income ÷ monthly maintenance hours"} />
      </div>
      <section className="ws-card mb-6">
        <div className="dimension-columns">
          <div>
            <Editable label="Build Effort (1 light – 5 heavy)" type="score" value={idea.setupEffort} onSave={save.field("setupEffort")} className="dimension-row" />
            <Editable label="Maintenance Effort" type="score" value={idea.ongoingEffort} onSave={save.field("ongoingEffort")} className="dimension-row" />
            <Editable label="Passive Potential" type="score" value={idea.passivePotential} onSave={save.field("passivePotential")} className="dimension-row" />
            <Editable label="Scalability" type="score" value={idea.scale} onSave={save.field("scale")} className="dimension-row" />
          </div>
          <div className="grid content-start gap-3">
            <Editable label="Maintenance Hours per Week" type="number" value={idea.maintenanceHours} onSave={save.field("maintenanceHours")} placeholder="Not set" />
            <Editable label="Weeks to First Income" type="number" value={idea.weeksToFirst} onSave={save.field("weeksToFirst")} placeholder="Not set" />
          </div>
        </div>
      </section>
      <div className="detail-grid">
        <DetailField idea={idea} detail="buildPlan" label="Build Plan" placeholder="What has to exist before the first sale?" />
        <DetailField idea={idea} detail="distribution" label="Audience / Distribution" placeholder="How buyers will discover it — the engine passive assets need" />
        <DetailField idea={idea} detail="automation" label="Automation" placeholder="What runs without you, and what never will" />
        <DetailField idea={idea} detail="maintenancePlan" label="Ongoing Maintenance" placeholder="Updates, support, restocking, platform changes" />
      </div>
    </>
  );
}

const LEVEL = ["", "Minimal", "Low", "Moderate", "High", "Severe"];

export function BarriersModule({ idea }: { idea: Idea }) {
  const { data, create, update } = useLab();
  const list = data.barriersByIdea.get(idea.id) ?? [];
  const byType = new Map(list.map(b => [b.type, b]));
  const rated = list.filter((b): b is Barrier & { rating: number } => typeof b.rating === "number");
  const avg = rated.length ? rated.reduce((a, b) => a + b.rating, 0) / rated.length : null;
  const highest = [...rated].sort((a, b) => b.rating - a.rating).slice(0, 2);

  const saveBarrier = (type: string, patch: Record<string, unknown>) => {
    const existing = byType.get(type);
    return existing ? update("barriers", existing.id, patch) : create("barriers", { ideaId: idea.id, type, ...patch });
  };

  return (
    <>
      <ModuleIntro icon={ShieldAlert} title="Barriers to Entry" description="What makes this hard to start — for you and for anyone else. Rate each from 1 (minimal) to 5 (severe), then note a mitigation." />
      <div className="stat-strip mb-6">
        <Stat label="Barriers Assessed" value={`${rated.length} / ${BARRIER_TYPES.length}`} />
        <Stat label="Average Rating" value={avg === null ? "—" : `${num(avg)} / 5`} note={avg === null ? undefined : LEVEL[Math.round(avg)]} />
        <Stat label="Highest Barriers" value={highest.length ? highest.map(b => BARRIER_TYPES.find(t => t.key === b.type)?.label).join(", ") : "—"} />
      </div>
      <div className="barrier-list">
        {BARRIER_TYPES.map(t => {
          const b = byType.get(t.key);
          return (
            <section key={t.key} className="barrier-row">
              <div className="barrier-head">
                <h3>{t.label}</h3>
                <Editable label={`${t.label} rating`} hideLabel type="score" value={b?.rating ?? null} onSave={v => saveBarrier(t.key, { rating: v })} />
                <span className="barrier-level">{b?.rating ? LEVEL[b.rating] : "Not rated"}</span>
              </div>
              <div className="barrier-body">
                <Editable label="Explanation" type="textarea" value={b?.explanation ?? ""} onSave={v => saveBarrier(t.key, { explanation: v })} placeholder="Why is this a barrier here?" />
                <Editable label="Mitigation Idea" type="textarea" value={b?.mitigation ?? ""} onSave={v => saveBarrier(t.key, { mitigation: v })} placeholder="How could it be lowered or avoided?" />
              </div>
            </section>
          );
        })}
      </div>
      <section className="ws-card mt-6">
        <DetailField idea={idea} detail="barrierSummary" label="Overall Summary" placeholder="Taken together — is this barrier profile acceptable for you right now?" />
      </section>
    </>
  );
}
