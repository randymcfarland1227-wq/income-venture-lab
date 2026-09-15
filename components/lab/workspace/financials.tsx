"use client";

import { TrendingUp } from "lucide-react";
import {
  SCENARIOS, breakEven, defaultFinancialModel, includesLong, money, moneyRange, num, scenarioResult,
  type FinancialModel, type Idea, type ScenarioKey,
} from "@/lib/domain";
import { CostPlanner } from "../pages/long-term";
import { useLab } from "../store";
import { Editable, SectionHeader, Stat } from "../ui";
import { ModuleIntro, useIdeaSave } from "./common";

export function FinancialsModule({ idea }: { idea: Idea }) {
  const { data, save, state } = useLab();
  const saveIdea = useIdeaSave(idea);
  const model = data.financialByIdea.get(idea.id) ?? defaultFinancialModel(idea);
  const actuals = data.actuals.get(idea.id);
  const unitMode = (model.unitPrice ?? 0) > 0;
  const expenses = (state?.expenses ?? []).filter(x => x.ideaId === idea.id);

  const patch = (p: Partial<FinancialModel>) => save({ op: "saveFinancials", ideaId: idea.id, model: { ...model, ...p } });
  const setScenario = (key: ScenarioKey, field: "units" | "revenue", value: string | number | null) =>
    patch({ scenarios: { ...model.scenarios, [key]: { ...model.scenarios[key], [field]: value === null ? null : Number(value) } } });
  const num0 = (v: string | number | null) => (v === null ? null : Number(v));

  const results = SCENARIOS.map(s => ({ ...s, r: scenarioResult(model, s.key) }));
  const maxAbs = Math.max(1, ...results.map(x => Math.abs(x.r.operating)));

  return (
    <>
      <ModuleIntro icon={TrendingUp} title="Financials" description="Editable assumptions and three scenarios. These are directional estimates for judgment — not projections, and never promises." />

      <div className="fin-layout">
        <section className="ws-card">
          <p className="eyebrow">Unit Economics</p>
          <div className="fin-inputs">
            <Editable label="What You Sell (Unit)" value={model.unitLabel} onSave={v => patch({ unitLabel: String(v ?? "") })} placeholder="customer, package, item…" />
            <Editable label={`Price per ${model.unitLabel || "Unit"}`} type="money" value={model.unitPrice} onSave={v => patch({ unitPrice: num0(v) })} placeholder="Leave blank to model revenue directly" />
            {unitMode
              ? <Editable label={`Variable Cost per ${model.unitLabel || "Unit"}`} type="money" value={model.variableCostPerUnit} onSave={v => patch({ variableCostPerUnit: num0(v) })} placeholder="$0" />
              : <Editable label="Variable Costs (% of Revenue)" type="number" value={model.variableCostPct} onSave={v => patch({ variableCostPct: num0(v) })} placeholder="0%" display={model.variableCostPct !== null ? `${model.variableCostPct}%` : undefined} />}
            <Editable label="Fixed Costs per Month" type="money" value={model.fixedMonthly} onSave={v => patch({ fixedMonthly: num0(v) })} placeholder="$0" />
            <Editable label="Startup Cost to Recoup" type="money" value={model.startupCost} onSave={v => patch({ startupCost: num0(v) })} placeholder="$0" />
          </div>
          <div className="break-even">
            <span>Break-even</span>
            <strong>{breakEven(model)}</strong>
          </div>
        </section>

        <section className="ws-card fin-scenarios">
          <p className="eyebrow">Monthly Scenarios</p>
          <div className="table-wrap mt-3 border-0 shadow-none">
            <table className="lab-table compact scenario-table">
              <thead>
                <tr><th />{results.map(s => <th key={s.key} className="num">{s.label}</th>)}</tr>
              </thead>
              <tbody>
                {unitMode ? (
                  <tr className="cursor-default"><th scope="row">{`${model.unitLabel || "Units"}s per month`.replace(/ss per/, "s per")}</th>
                    {results.map(s => <td key={s.key} className="num"><Editable label={`${s.label} units`} hideLabel type="number" value={model.scenarios[s.key].units} onSave={v => setScenario(s.key, "units", v)} placeholder="Set" /></td>)}
                  </tr>
                ) : null}
                <tr className="cursor-default"><th scope="row">Revenue</th>
                  {results.map(s => (
                    <td key={s.key} className="num">
                      {unitMode ? money(s.r.revenue) : <Editable label={`${s.label} revenue`} hideLabel type="money" value={model.scenarios[s.key].revenue} onSave={v => setScenario(s.key, "revenue", v)} placeholder="Set" />}
                    </td>
                  ))}
                </tr>
                <tr className="cursor-default"><th scope="row">Variable costs</th>{results.map(s => <td key={s.key} className="num">{money(-s.r.variable)}</td>)}</tr>
                <tr className="cursor-default"><th scope="row">Gross profit</th>{results.map(s => <td key={s.key} className="num">{money(s.r.gross)}</td>)}</tr>
                <tr className="cursor-default"><th scope="row">Fixed costs</th>{results.map(s => <td key={s.key} className="num">{money(-s.r.fixed)}</td>)}</tr>
                <tr className="cursor-default total"><th scope="row">Operating profit</th>{results.map(s => <td key={s.key} className="num">{money(s.r.operating)}</td>)}</tr>
                <tr className="cursor-default"><th scope="row">Months to recoup startup</th>{results.map(s => <td key={s.key} className="num">{s.r.payback === null ? "—" : num(s.r.payback)}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <div className="scenario-bars" aria-label="Operating profit by scenario">
            {results.map(s => (
              <div key={s.key} className="scenario-bar-row">
                <span className="scenario-name">{s.label}<small>{s.note}</small></span>
                <span className="scenario-track">
                  <span className={s.r.operating < 0 ? "neg" : "pos"} style={{ width: `${Math.max(2, (Math.abs(s.r.operating) / maxAbs) * 100)}%` }} />
                </span>
                <strong>{money(s.r.operating)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <SectionHeader eyebrow="Syncs With the Workbook" title="Planning Ranges" description="The ranges stored on the idea itself — edits here reach the Google Sheet." />
        <div className="ws-card fin-ranges">
          <Editable label="Startup Low" type="money" value={idea.startupLow} onSave={saveIdea.field("startupLow")} placeholder="Not set" />
          {includesLong(idea.horizon) && <Editable label="Startup High" type="money" value={idea.startupHigh} onSave={saveIdea.field("startupHigh")} placeholder="Not set" />}
          {includesLong(idea.horizon) && <Editable label="Monthly Operating Cost" type="money" value={idea.monthlyCost} onSave={saveIdea.field("monthlyCost")} placeholder="Not set" />}
          <Editable label="Monthly Revenue Low" type="money" value={idea.monthlyLow} onSave={saveIdea.field("monthlyLow")} placeholder="Not set" />
          <Editable label="Monthly Revenue High" type="money" value={idea.monthlyHigh} onSave={saveIdea.field("monthlyHigh")} placeholder="Not set" />
          <p className="self-end text-xs text-muted-foreground">Range: {moneyRange(idea.monthlyLow, idea.monthlyHigh)} / month</p>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader eyebrow="What Actually Happened" title="Actuals" description="From experiment results, plan actuals, and recorded expenses." />
        <div className="stat-strip">
          <Stat label="Revenue" value={money(actuals?.revenue ?? 0)} />
          <Stat label="Costs" value={money(actuals?.costs ?? 0)} />
          <Stat label="Net" value={money(actuals?.net ?? 0)} />
          <Stat label="Net per Hour" value={actuals?.netPerHour == null ? "—" : money(actuals.netPerHour)} note={actuals?.hours ? `${actuals.hours} hours` : "No hours logged"} />
        </div>
      </section>

      {(includesLong(idea.horizon) || expenses.length > 0) && (
        <section className="mt-10">
          <CostPlanner expenses={expenses} ideaId={idea.id} />
        </section>
      )}
    </>
  );
}
