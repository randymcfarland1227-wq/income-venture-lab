import {
  ASSUMPTION_STATUSES, BARRIER_TYPES, CONFIDENCE, COST_TYPES, DECISIONS, EXPERIMENT_STATUSES, MILESTONE_STATUSES,
  RESEARCH_KINDS, STAGES, type Collection,
} from "@/lib/domain";

export type FieldType =
  | "text" | "textarea" | "number" | "money" | "date" | "select" | "url" | "tags"
  | "idea" | "investment" | "assumption" | "cites" | "score";

export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[] | ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
  required?: boolean;
  section?: string;
};

export const MARKET_KINDS = ["Observation", "Data Point", "Pricing", "Demand Signal", "Trend", "Question"] as const;

export const FORMS: Record<Collection | "marketResearch", FieldSpec[]> = {
  ideas: [],
  experiments: [
    { key: "name", label: "Experiment Name", type: "text", placeholder: "e.g. Five-listing weekend test", wide: true, section: "Plan" },
    { key: "ideaId", label: "Linked Idea", type: "idea", section: "Plan" },
    { key: "status", label: "Status", type: "select", options: EXPERIMENT_STATUSES, section: "Plan" },
    { key: "hypothesis", label: "Hypothesis", type: "textarea", wide: true, placeholder: "If I …, then … because …", section: "Plan" },
    { key: "testAction", label: "Test Action", type: "textarea", wide: true, section: "Plan" },
    { key: "successSignal", label: "Success Signal", type: "text", wide: true, placeholder: "What result means “keep going”?", section: "Plan" },
    { key: "startDate", label: "Start Date", type: "date", section: "Plan" },
    { key: "decisionDate", label: "Decision Date", type: "date", section: "Plan" },
    { key: "budget", label: "Budget", type: "money", section: "Plan" },
    { key: "timeBudget", label: "Time Budget (hrs)", type: "number", section: "Plan" },
    { key: "assumptionId", label: "Tests Assumption", type: "assumption", wide: true, section: "Plan" },
    { key: "actualHours", label: "Actual Hours", type: "number", section: "Results" },
    { key: "leads", label: "Leads", type: "number", section: "Results" },
    { key: "replies", label: "Replies", type: "number", section: "Results" },
    { key: "sales", label: "Sales", type: "number", section: "Results" },
    { key: "revenue", label: "Revenue", type: "money", section: "Results" },
    { key: "directCosts", label: "Direct Costs", type: "money", section: "Results" },
    { key: "result", label: "Result", type: "textarea", wide: true, section: "Results" },
    { key: "learning", label: "Decision / Learning", type: "textarea", wide: true, hint: "Syncs to the tracker’s Decision / learning column", section: "Results" },
    { key: "finalDecision", label: "Final Decision", type: "select", options: DECISIONS, section: "Results" },
  ],
  sprint: [
    { key: "action", label: "Action", type: "text", wide: true, required: true },
    { key: "ideaId", label: "Linked Idea", type: "idea" },
    { key: "day", label: "Day", type: "text", placeholder: "e.g. 1" },
    { key: "status", label: "Status", type: "select", options: ["Not Started", "In Progress", "Done", "Skipped"] },
    { key: "deliverable", label: "Deliverable", type: "text", wide: true },
    { key: "time", label: "Time", type: "text", placeholder: "e.g. 45 min" },
    { key: "costCap", label: "Cost Cap", type: "money" },
    { key: "successSignal", label: "Success Signal", type: "text", wide: true },
    { key: "resultNotes", label: "Result / Notes", type: "textarea", wide: true },
  ],
  research: [
    { key: "kind", label: "Type", type: "select", options: RESEARCH_KINDS },
    { key: "confidence", label: "Confidence", type: "select", options: CONFIDENCE },
    { key: "title", label: "Title", type: "text", wide: true, required: true, placeholder: "e.g. Venue A charges $6,000 on Saturdays" },
    { key: "body", label: "Notes", type: "textarea", wide: true },
    { key: "sourceUrl", label: "Source URL / Reference", type: "url", wide: true },
    { key: "date", label: "Date", type: "date" },
    { key: "tags", label: "Tags", type: "tags", placeholder: "pricing, local, weekend" },
  ],
  marketResearch: [
    { key: "kind", label: "Type", type: "select", options: MARKET_KINDS },
    { key: "confidence", label: "Confidence", type: "select", options: CONFIDENCE },
    { key: "title", label: "Finding", type: "textarea", wide: true, required: true, placeholder: "A fact, observation, or data point" },
    { key: "sourceUrl", label: "Source URL / Reference", type: "url", wide: true },
    { key: "date", label: "Date", type: "date" },
    { key: "tags", label: "Tags", type: "tags" },
    { key: "body", label: "Notes", type: "textarea", wide: true },
  ],
  competitors: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "url", label: "URL", type: "url" },
    { key: "location", label: "Location", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "targetCustomer", label: "Target Customer", type: "text" },
    { key: "pricing", label: "Pricing", type: "text", placeholder: "e.g. $4,500–$7,000 per event" },
    { key: "positioning", label: "Positioning", type: "textarea", wide: true },
    { key: "strengths", label: "Strengths", type: "textarea" },
    { key: "weaknesses", label: "Weaknesses", type: "textarea" },
    { key: "features", label: "Notable Features", type: "textarea", wide: true },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ],
  assumptions: [
    { key: "assumption", label: "Assumption", type: "textarea", wide: true, required: true, placeholder: "e.g. Customers will pay $4,000+ for this service." },
    { key: "status", label: "Status", type: "select", options: ASSUMPTION_STATUSES },
    { key: "evidence", label: "Evidence So Far", type: "textarea", wide: true },
  ],
  barriers: [
    { key: "type", label: "Barrier", type: "select", options: BARRIER_TYPES.map(b => ({ value: b.key, label: b.label })) },
    { key: "rating", label: "Rating (1 low – 5 high)", type: "score" },
    { key: "explanation", label: "Explanation", type: "textarea", wide: true },
    { key: "mitigation", label: "Mitigation Idea", type: "textarea", wide: true },
  ],
  milestones: [
    { key: "title", label: "Milestone / Hypothesis", type: "text", wide: true, required: true },
    { key: "ideaId", label: "Linked Idea", type: "idea" },
    { key: "stage", label: "Stage", type: "select", options: STAGES },
    { key: "status", label: "Status", type: "select", options: MILESTONE_STATUSES },
    { key: "month", label: "Plan Month (1–12)", type: "number" },
    { key: "targetDate", label: "Target Date", type: "date" },
    { key: "spendingCap", label: "Spending Cap", type: "money" },
    { key: "timeBudget", label: "Time Budget (hrs)", type: "number" },
    { key: "targetIncome", label: "Target Monthly Income", type: "money" },
    { key: "actualIncome", label: "Actual Monthly Income", type: "money" },
    { key: "nextAction", label: "Next Action", type: "text", wide: true },
    { key: "evidenceNotes", label: "Evidence / Decision Notes", type: "textarea", wide: true },
  ],
  expenses: [
    { key: "item", label: "Expense Item", type: "text", wide: true, required: true },
    { key: "ideaId", label: "Linked Idea", type: "idea" },
    { key: "category", label: "Expense Category", type: "text", placeholder: "e.g. Insurance" },
    { key: "costType", label: "Cost Type", type: "select", options: COST_TYPES },
    { key: "essential", label: "Essential?", type: "select", options: ["Yes", "No"] },
    { key: "low", label: "Low Estimate", type: "money" },
    { key: "high", label: "High Estimate", type: "money" },
    { key: "actual", label: "Actual", type: "money" },
    { key: "dueDate", label: "Due / Start Date", type: "date" },
    { key: "notes", label: "Notes / Vendor", type: "textarea", wide: true },
  ],
  findings: [
    { key: "title", label: "Finding", type: "text", wide: true, required: true, placeholder: "A conclusion drawn from research or experiments" },
    { key: "body", label: "Explanation", type: "textarea", wide: true },
    { key: "scope", label: "Applies To", type: "select", options: ["Global", "Short Term", "Long Term", "Passive", "Investing", "Idea"] },
    { key: "confidence", label: "Confidence", type: "select", options: CONFIDENCE },
    { key: "ideaId", label: "Related Idea", type: "idea" },
    { key: "evidence", label: "Evidence", type: "textarea", wide: true },
    { key: "cites", label: "Cites Research", type: "cites", wide: true },
  ],
  investments: [
    { key: "name", label: "Investment / Account", type: "text", wide: true, required: true },
    { key: "classification", label: "Classification", type: "text" },
    { key: "category", label: "Category", type: "select", options: ["Cash & Capital Preservation", "Bonds & Fixed Income", "Stocks & Equity", "Funds", "Real Estate", "Alternative Assets", "Investment Accounts", "Benchmarks"] },
    { key: "accountOrAsset", label: "Account or Asset?", type: "select", options: ["Account", "Asset", "Fund", "Security", "Benchmark", "Cash product", "Other"] },
    { key: "symbol", label: "Symbol / Series", type: "text", hint: "Optional. A licensed quote provider is required for security prices." },
    { key: "status", label: "Personal Status", type: "select", options: ["Learn", "Considering", "Researching", "Watch", "Paper Trial", "Own", "Paused", "Avoid", "Archived"] },
    { key: "definition", label: "What is it?", type: "textarea", wide: true },
    { key: "returnMechanism", label: "How It Produces Returns", type: "textarea", wide: true },
    { key: "horizon", label: "Typical Horizon", type: "text" },
    { key: "liquidity", label: "Liquidity", type: "text" },
    { key: "incomeFrequency", label: "Income Frequency", type: "text" },
    { key: "passiveLevel", label: "Passive Nature", type: "select", options: ["Low ongoing involvement", "Medium", "High ongoing involvement", "Not applicable"] },
    { key: "benchmark", label: "Benchmark", type: "text" },
    { key: "minimumAccessNotes", label: "Minimum / Access Notes", type: "textarea", wide: true },
    { key: "feesExpenseNotes", label: "Fees / Expense Notes", type: "textarea", wide: true },
    { key: "taxAccountNotes", label: "Tax / Account Notes", type: "textarea", wide: true },
    { key: "notes", label: "Personal Notes", type: "textarea", wide: true },
  ],
  investmentExperiments: [
    { key: "investmentId", label: "Linked Investment", type: "investment", required: true, section: "Plan" },
    { key: "name", label: "Experiment Name", type: "text", wide: true, required: true, section: "Plan" },
    { key: "mode", label: "Mode", type: "select", options: ["Paper", "Actual"], section: "Plan" },
    { key: "status", label: "Status", type: "select", options: ["Planned", "Running", "Reviewing", "Complete", "Paused"], section: "Plan" },
    { key: "hypothesis", label: "Question / Hypothesis", type: "textarea", wide: true, section: "Plan" },
    { key: "benchmark", label: "Benchmark", type: "text", section: "Plan" },
    { key: "startDate", label: "Start Date", type: "date", section: "Plan" },
    { key: "reviewDate", label: "Review Date", type: "date", section: "Plan" },
    { key: "startingAmount", label: "Starting Amount", type: "money", section: "Amounts" },
    { key: "recurringContribution", label: "Recurring Monthly Contribution", type: "money", section: "Amounts" },
    { key: "startPrice", label: "Starting Price / Level", type: "number", section: "Amounts", hint: "Use the verified level shown on the start date where available." },
    { key: "fees", label: "Fees", type: "money", section: "Amounts" },
    { key: "distributions", label: "Dividends / Distributions Tracked", type: "money", section: "Amounts" },
    { key: "notes", label: "Notes", type: "textarea", wide: true, section: "Learning" },
    { key: "learning", label: "What Happened / What I Learned", type: "textarea", wide: true, section: "Learning" },
    { key: "finalDecision", label: "Next Learning Decision", type: "select", options: ["Continue Learning", "Consider", "Watch", "Own / Continue", "Pause", "Avoid"], section: "Learning" },
  ],
};
