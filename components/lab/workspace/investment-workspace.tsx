"use client";

import { ArrowLeft, ArrowRight, ExternalLink, FileText, FlaskConical, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvestmentExperiment, ResearchItem } from "@/lib/domain";
import { INVESTMENT_MODULES, INVESTMENT_STATUSES, money, shortDate } from "@/lib/domain";
import { FORMS } from "../forms";
import { useLab } from "../store";
import { Editable, Empty, RecordDialog, StatusPill, Tag, useRecordDialog } from "../ui";

export function InvestmentWorkspace({ investmentId, module = "overview" }: { investmentId: string; module?: string }) {
  const { state, go, back, update, data } = useLab();
  const option = state?.investments.find(item => item.id === investmentId);
  if (!option) return <Empty title="Investment not found" text="It may have been archived or removed." action={<Button onClick={() => back("investing")}>Back to Investing</Button>} />;
  const experiments = (state?.investmentExperiments ?? []).filter(item => item.investmentId === option.id);
  const research = (state?.research ?? []).filter(item => item.investmentId === option.id);
  const rules = (state?.investmentRules ?? []).filter(item => item.investmentId === option.id);
  const metrics = (state?.investmentMetrics ?? []).filter(item => item.investmentId === option.id);
  const propertyIdea = option.id === "inv-direct-real-estate" ? data.ideas.find(idea => /real estate|rental property/i.test(idea.title)) : undefined;
  const set = (field: string, value: unknown) => update("investments", option.id, { [field]: value });

  return <div className="investment-workspace">
    <button className="workspace-back" onClick={() => back("investing")}><ArrowLeft /> Back to Investing &amp; Assets</button>
    <header className="investment-workspace-head">
      <div><div className="flex flex-wrap gap-2"><Tag>{option.accountOrAsset}</Tag><Tag>{option.classification}</Tag><StatusPill status={option.status} /></div>
        <h1>{option.name}</h1><p>{option.definition}</p></div>
      <div className="investment-identity"><span>Account or asset?</span><strong>{option.accountOrAsset}</strong><small>{option.accountOrAsset === "Account" ? "The account holds investments; it does not create performance by itself." : option.accountOrAsset === "Benchmark" ? "A measurement, not a purchasable security." : "A product or asset whose own characteristics matter."}</small></div>
    </header>
    <nav className="workspace-modules" aria-label="Investment workspace modules">{INVESTMENT_MODULES.map(item => <button key={item.key} className={module === item.key ? "active" : ""} onClick={() => go(`investment/${option.id}/${item.key}`)}>{item.label}</button>)}</nav>

    {module === "risk" ? <Risk option={option} />
      : module === "performance" ? <Performance option={option} metrics={metrics} />
      : module === "costs" ? <Costs option={option} rules={rules} set={set} />
      : module === "research" ? <Research optionId={option.id} rows={research} />
      : module === "experiments" ? <Experiments optionId={option.id} optionName={option.name} rows={experiments} />
      : module === "notes" ? <section className="workspace-panel"><h2>Personal Notes</h2><Editable label="Why I’m considering it, concerns, questions, and lessons" value={option.notes} type="textarea" onSave={value => set("notes", value)} /></section>
      : module === "how" ? <section className="workspace-grid two"><div className="workspace-panel"><h2>How It Works</h2><Info label="Return mechanism" value={option.returnMechanism} /><Info label="Income frequency" value={option.incomeFrequency} /><Info label="Passive nature" value={option.passiveLevel} /></div><div className="workspace-panel"><h2>Access &amp; Structure</h2><Info label="Typical horizon" value={option.horizon} /><Info label="Liquidity" value={option.liquidity} /><Info label="Diversification" value={option.diversification} /></div></section>
      : <section className="workspace-grid two"><div className="workspace-panel"><h2>Overview</h2><Info label="What is it?" value={option.definition} /><Info label="Investment category" value={option.category} /><Info label="Account or asset?" value={option.accountOrAsset} /><Info label="How it produces returns" value={option.returnMechanism} /></div><div className="workspace-panel"><h2>Your Research Position</h2><Editable label="Status" value={option.status} type="select" options={INVESTMENT_STATUSES} onSave={value => set("status", value)} /><Editable label="Interest" value={option.personalInterest} type="score" onSave={value => set("personalInterest", value)} /><Editable label="Understanding" value={option.personalUnderstanding} type="score" onSave={value => set("personalUnderstanding", value)} /><Editable label="Comfort with risk" value={option.riskComfort} type="score" onSave={value => set("riskComfort", value)} />{propertyIdea && <Button variant="outline" className="mt-4" onClick={() => go(`idea/${propertyIdea.id}`)}>Open existing real-estate workspace <ArrowRight /></Button>}</div></section>}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="workspace-info"><span>{label}</span><p>{value || "Not yet documented."}</p></div>; }

function Risk({ option }: { option: NonNullable<ReturnType<typeof useLab>["state"]>["investments"][number] }) {
  const labels: Record<string, string> = { market: "Market Risk", principal: "Principal Risk", credit: "Credit Risk", interestRate: "Interest Rate Risk", inflation: "Inflation Risk", liquidity: "Liquidity Risk", concentration: "Concentration Risk", regulatory: "Regulatory / Structural Risk", complexity: "Complexity" };
  return <section><div className="workspace-section-head"><div><p className="eyebrow">Structured Profile</p><h2>Risk is multidimensional</h2><p>No single badge can describe every way an investment can disappoint or lose value.</p></div><ShieldAlert /></div><div className="risk-grid">{Object.entries(labels).map(([key, label]) => { const item = option.riskProfile[key as keyof typeof option.riskProfile]; return <article key={key}><div className="flex justify-between gap-2"><h3>{label}</h3><Tag className={item?.level === "High" ? "tone-warn" : ""}>{item?.level ?? "Varies"}</Tag></div><p>{item?.explanation ?? "This dimension varies by product structure and provider."}</p></article>; })}</div></section>;
}

function Performance({ option, metrics }: { option: NonNullable<ReturnType<typeof useLab>["state"]>["investments"][number]; metrics: NonNullable<ReturnType<typeof useLab>["state"]>["investmentMetrics"] }) {
  const ordered = [...metrics].sort((a, b) => b.observationDate.localeCompare(a.observationDate));
  return <section className="grid gap-5"><div className="workspace-section-head"><div><p className="eyebrow">Source-Derived Facts</p><h2>Performance &amp; Data</h2><p>Historical results are not a guarantee of future performance. Bond yields, price returns, and total returns are different measures.</p></div></div>
    {ordered.length ? <div className="metric-ledger">{ordered.slice(0, 12).map(metric => <article key={metric.id}><div><span>{metric.metric.replaceAll("_", " ")}</span><strong>{metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}{metric.unit === "percent" ? "%" : ""}</strong></div><p>{metric.methodology}</p><footer><a href={metric.sourceUrl} target="_blank" rel="noreferrer">Source: {metric.sourceName} <ExternalLink /></a><span>As of {shortDate(metric.observationDate)} · fetched {shortDate(metric.fetchedAt)}</span>{metric.isStale && <Tag>Stale</Tag>}</footer></article>)}</div>
      : <Empty icon={FileText} title="No verified metric for this option" text={option.symbol ? "A licensed live-quote provider is not configured. Research and notes remain available." : "This investment type may not have one meaningful live metric."} />}
  </section>;
}

function Costs({ option, rules, set }: { option: NonNullable<ReturnType<typeof useLab>["state"]>["investments"][number]; rules: NonNullable<ReturnType<typeof useLab>["state"]>["investmentRules"]; set: (field: string, value: unknown) => Promise<boolean> }) {
  return <section className="workspace-grid two"><div className="workspace-panel"><h2>Costs &amp; Access</h2><Editable label="Minimum / access notes" value={option.minimumAccessNotes} type="textarea" onSave={value => set("minimumAccessNotes", value)} /><Editable label="Fees / expense notes" value={option.feesExpenseNotes} type="textarea" onSave={value => set("feesExpenseNotes", value)} /></div><div className="workspace-panel"><h2>Tax &amp; Account Rules</h2><Editable label="Educational tax / account notes" value={option.taxAccountNotes} type="textarea" onSave={value => set("taxAccountNotes", value)} />{rules.map(rule => <article key={rule.id} className="rule-card"><span>{rule.ruleYear} rule</span><strong>{rule.summary}: {rule.unit === "USD" ? money(Number(rule.value)) : rule.value}</strong><a href={rule.sourceUrl} target="_blank" rel="noreferrer">Source: {rule.sourceName}</a></article>)}{option.accountOrAsset === "Account" && !rules.length && <p className="mt-4 text-sm text-muted-foreground">No verified current-year limit is cached for this account. The Lab will not substitute an old or invented number.</p>}</div></section>;
}

function Research({ optionId, rows }: { optionId: string; rows: ResearchItem[] }) {
  const { create, update, archive } = useLab(); const dialog = useRecordDialog<ResearchItem>();
  return <section className="grid gap-4"><div className="workspace-section-head"><div><p className="eyebrow">Evidence &amp; Questions</p><h2>Research</h2></div><Button onClick={dialog.openNew}><Plus /> Add Research</Button></div>{rows.length ? <div className="research-list">{rows.map(row => <button key={row.id} onClick={() => dialog.openEdit(row)}><Tag>{row.kind}</Tag><strong>{row.title}</strong><p>{row.body}</p>{row.sourceUrl && <span>{row.sourceUrl}</span>}</button>)}</div> : <Empty icon={FileText} title="No research yet" text="Save official links, questions, findings, and your own interpretation here." />}
    <RecordDialog open={dialog.isOpen} onOpenChange={open => { if (!open) dialog.close(); }} title={dialog.record ? "Edit Research" : "New Research"} fields={FORMS.research} initial={dialog.record ?? { kind: "Note", area: "Investing", investmentId: optionId }} onSubmit={values => dialog.record ? update("research", dialog.record.id, { ...values, investmentId: optionId, area: "Investing" }) : create("research", { ...values, investmentId: optionId, area: "Investing" })} onDelete={dialog.record ? () => archive("research", dialog.record!.id, dialog.record!.title) : undefined} />
  </section>;
}

function Experiments({ optionId, optionName, rows }: { optionId: string; optionName: string; rows: InvestmentExperiment[] }) {
  const { create, update, archive } = useLab(); const dialog = useRecordDialog<InvestmentExperiment>();
  return <section className="grid gap-4"><div className="workspace-section-head"><div><p className="eyebrow">Learn Without Trading</p><h2>Experiments</h2></div><Button onClick={dialog.openNew}><Plus /> New Experiment</Button></div>{rows.length ? <div className="experiment-grid">{rows.map(row => <button key={row.id} className="panel text-left" onClick={() => dialog.openEdit(row)}><div className="flex justify-between"><Tag>{row.mode}</Tag><StatusPill status={row.status} /></div><h3 className="mt-3 font-display text-xl">{row.name}</h3><p className="mt-2 text-sm text-muted-foreground">{row.hypothesis}</p><strong className="mt-4 block">{row.currentValue === null ? "Not calculated yet" : `${money(row.currentValue)} · ${row.returnPct?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—"}%`}</strong></button>)}</div> : <Empty icon={FlaskConical} title="No trial for this investment" text="A paper trial records what happens without placing a trade." />}
    <RecordDialog open={dialog.isOpen} onOpenChange={open => { if (!open) dialog.close(); }} title={dialog.record ? "Edit Investment Experiment" : "New Investment Experiment"} description="Paper uses no real money. Actual is a manual log only." fields={FORMS.investmentExperiments} initial={dialog.record ?? { investmentId: optionId, investmentLabel: optionName, mode: "Paper", status: "Planned" }} onSubmit={values => dialog.record ? update("investmentExperiments", dialog.record.id, values) : create("investmentExperiments", { ...values, investmentId: optionId })} onDelete={dialog.record ? () => archive("investmentExperiments", dialog.record!.id, dialog.record!.name) : undefined} />
  </section>;
}
