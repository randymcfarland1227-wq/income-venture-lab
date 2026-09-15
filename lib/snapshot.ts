/**
 * A read of both workbooks taken on 2026-09-14, used only to populate a brand-new database
 * before the Google Sheets connection is authorized. Rows are fed through the exact same
 * header mapping as a live pull, and each snapshot record is linked to its live row (by
 * title, once) the first time the sheet is reached. After that `_sync_id` is the identity.
 *
 * Cells are separated by "|"; the first line of each table is its header row.
 */

export const SNAPSHOT_TAKEN_AT = "2026-09-14T19:30:00.000Z";

const shortIdeas = `ID|Status|Tier|Category|Opportunity|Personal fit / angle|First cash|Startup cost|Weekly hrs|Income model|Low monthly|High monthly|Speed 1-5|Fit 1-5|Demand 1-5|Scale 1-5|Low cost 1-5|Low risk 1-5|Score /100|First test
1|Shortlist|A|Sell what you own|Sell unused electronics|Fastest likely cash; photograph, reset securely, and list locally|1-7 days|0|3|One-time|100|1500|5|4|5|1|5|5|#REF!|List 5 items with clear photos and fair prices
2|Shortlist|A|Sell what you own|Sell clothing, shoes, and accessories|Bundle lower-value items; cross-list only the best pieces|1-14 days|0|3|One-time|50|600|5|3|4|1|5|5|#REF!|Create one keep/sell/donate sorting session
8|Shortlist|A|Technical service|Home technology setup and troubleshooting|Use customer support and hardware/software troubleshooting experience|3-21 days|50|8|Hourly / package|250|2200|4|5|4|2|4|4|#REF!|Offer Wi-Fi, printer, device, and smart-home setup
9|Shortlist|A|Marketing service|Small-business content and Canva package|Use campaigns, events, 36+ assets, Canva/Photoshop/CapCut experience|1-4 weeks|25|8|Project / retainer|300|2500|3|5|4|3|5|4|#REF!|Make a 10-post sample pack for one local niche
10|Consider|A|Freelance|Data entry, spreadsheet QA, and virtual operations support|Lower-friction version of analytics experience; good for short contracts|1-4 weeks|0|10|Hourly / project|300|2200|3|5|4|2|5|4|#REF!|Create profiles on two reputable freelance platforms
15|Consider|B|Marketing service|Event planning and vendor coordination|Strong events/communications fit; sell a checklist-driven package|2-8 weeks|50|8|Project|300|3000|3|5|3|2|4|4|#REF!|Offer coordination for one small nonprofit/business event
17|Consider|B|Technical service|Remote software onboarding help|Support small teams adopting Google Workspace or Microsoft tools|2-8 weeks|25|8|Project / hourly|300|2500|3|4|3|3|5|4|#REF!|Draft a 60-minute onboarding package
19|Consider|B|Reselling|Marketplace flipping|Start only with free/underpriced local items and strict margin rules|1-4 weeks|100|8|Resale margin|200|1800|3|3|4|3|3|3|#REF!|Flip 3 items; no inventory purchase over $25
20|Consider|B|Reselling|Niche resale: electronics/accessories|Technical comfort helps testing and describing items accurately|1-4 weeks|150|8|Resale margin|250|2000|3|4|4|3|3|3|#REF!|Choose one niche and document sold-price comps
23|Consider|B|Local service|Delivery / courier work|Reliable transportation; account for fuel, insurance, and wear|1-3 weeks|50|12|Hourly|300|1800|4|3|4|1|4|3|#REF!|Track net hourly earnings for 3 shifts
24|Consider|B|Local service|Furniture assembly / basic setup|Offer only tasks within skill and safety limits|1-4 weeks|100|6|Per task|200|1600|3|3|4|2|3|3|#REF!|List exact tasks you can perform confidently
29|Consider|B|Digital product|Small-business content calendar templates|Fits marketing workflow experience|1-3 months|25|5|Product sales|25|1000|2|4|3|5|5|4|#REF!|Create one niche-specific calendar
30|Consider|B|Creator service|Short-form video editing|CapCut experience; sell a limited monthly clip package|2-8 weeks|25|8|Project / retainer|200|2200|3|4|4|3|5|4|#REF!|Edit 3 sample clips from licensed footage
31|Research|C|Ecommerce|Print-on-demand store|No inventory, but niche selection and customer acquisition are hard|2-6 months|100|8|Product margin|0|1500|1|4|2|4|4|3|#REF!|Validate 10 designs with audience feedback before ads
35|Research|C|Content|YouTube/tutorial content on Excel and automation|Strong topic fit; monetization is slow and uncertain|6-18 months|150|8|Ads / affiliates / products|0|2000|1|5|2|5|3|4|#REF!|Publish 4 useful tutorials before buying equipment
38|Research|C|Creator|UGC-style product videos|Marketing/content fit without needing a large audience|1-3 months|100|6|Per video / package|100|1800|2|4|3|3|4|4|#REF!|Create 5 sample product videos with items you own
39|Research|C|Rental/assets|Rent parking/storage space|Potentially passive if you control suitable space and local rules allow|1-4 weeks|0|1|Rental|0|400|3|2|3|3|5|3|#REF!|Confirm property/lease rules and local demand
40|Research|C|Rental/assets|Rent equipment you already own|Only for durable items; require deposits, photos, and insurance review|1-4 weeks|25|2|Rental|25|500|3|2|3|3|5|2|#REF!|Inventory rentable assets and replacement values
41|Research|C|Rental/assets|Car sharing|Revenue can be offset by depreciation, insurance, cleaning, and downtime|2-6 weeks|100|4|Rental|100|1000|2|3|3|3|3|2|#REF!|Estimate true net income including wear and risk
42|Consider|B|Administrative service|CRM/data cleanup|Transferable from data QA, Salesforce exposure, and operations|2-8 weeks|25|8|Project|300|2800|3|5|4|3|5|4|#REF!|Build a sample duplicate/field-quality audit
43|Consider|B|Administrative service|SOP and process documentation|Process-improvement experience fits clear checklists and handoffs|2-8 weeks|25|7|Project|300|2500|3|5|4|3|5|5|#REF!|Write one anonymized sample SOP
44|Consider|B|Research service|Competitor and market research briefs|Marketing + analytical synthesis; keep deliverable narrow|2-8 weeks|25|7|Project|250|2200|3|4|3|3|5|4|#REF!|Create a 5-page sample brief for a local niche
45|Consider|B|Marketing service|Local business listing and review-response setup|Operational marketing package with clear deliverables|1-6 weeks|25|5|Project / retainer|200|1600|3|4|4|3|5|4|#REF!|Audit five businesses and prepare one sample report
46|Consider|B|Bridge work|Temporary office / operations assignments|Direct fit and can preserve weekday schedule|1-4 weeks|0|20|Hourly|1200|3500|4|5|5|1|5|5|#REF!|Contact 5 staffing firms with a two-sentence target
47|Consider|B|Bridge work|Election/event check-in or registration staffing|Short engagements; administration and public-facing strengths|1-8 weeks|0|6|Hourly|100|800|3|4|3|1|5|4|#REF!|Search county, venue, and staffing rosters
48|Consider|B|Microbusiness|Back-office setup for solo businesses|Bundle invoicing tracker, simple CRM, file structure, and recurring reporting|2-8 weeks|50|8|Package / support|400|3500|3|5|4|4|4|4|#REF!|Package a one-week back-office reset
49|Research|C|Microbusiness|Local event promotion service|Use content, partnerships, and event experience; requires client acquisition|1-3 months|100|10|Project|200|2500|2|5|3|3|3|3|#REF!|Pilot with one community event
50|Research|C|Microbusiness|Nonprofit operations support|Reporting, events, communications, and process help can combine well|1-3 months|50|8|Project / retainer|300|3000|2|5|3|4|4|4|#REF!|Interview 3 small nonprofits about admin bottlenecks
51|Research|C|Passive-ish|High-yield savings / short-term Treasury ladder|Capital-preservation tool, not meaningful income without substantial savings|1-7 days|0|1|Interest|0|300|5|2|5|4|5|5|#REF!|Compare insured/liquid options; do not chase yield
52|Research|C|Passive-ish|Dividend investing|Market risk and capital required; not a layoff cash-flow substitute|Years|100|1|Dividends / appreciation|0|500|1|2|3|5|4|2|#REF!|Only consider after emergency cash needs are covered
53|Avoid for now|D|High risk|Amazon FBA / bulk private label|Inventory, fees, returns, and cash tied up make this a poor short-term fit|4-12 months|2000|10|Product margin|0|3000|1|3|3|5|1|1|#REF!|Do not fund until validated with preorders or tiny test
54|Avoid for now|D|High risk|Vending machine route|Asset, location, maintenance, and restocking needs; not passive at first|2-8 months|3000|8|Product margin|100|1800|1|2|3|3|1|2|#REF!|Research location economics before purchasing equipment
55|Avoid for now|D|High risk|Franchise or expensive course-led business|Large sunk costs and sales pressure conflict with current needs|Months/years|5000|15|Varies|0|5000|1|2|2|3|1|1|#REF!|Do not pay before independent diligence and legal review
56|Avoid for now|D|High risk|Crypto trading / day trading|Speculation is not dependable income and can worsen layoff risk|Immediate losses possible|500|10|Speculation|-500|1000|1|1|2|2|2|1|#REF!|Keep out of the income-replacement plan
57|Avoid for now|D|High risk|MLM / recruitment-led sales|Income claims and inventory pressure often obscure weak economics|Unknown|250|10|Commission / recruitment|0|500|1|1|2|2|2|1|#REF!|Decline any pay-to-join or inventory-loading offer`;

const longIdeas = `Category|Income Path|How It Earns|Style|Startup Low|Startup High|Monthly Cost|Weeks to First $|Hours / Week|Monthly Income Low|Monthly Income High|Skill Fit 1–5|Interest 1–5|Risk Comfort 1–5|Passive Potential 1–5|Setup Effort 1–5|Ongoing Effort 1–5|Sales Effort 1–5|Complexity 1–5|Overall Effort 1–5|Fit Score /100|Status|First Low-Cost Test|Notes
Bridge Income|Contract role in your field|Short-term project or interim assignment|Active|0|300|50|2|30|3000|10000|3|3|4|1|1|4|2|2|2.25|77|Explore|Message 10 former colleagues/recruiters|Fastest when network and portfolio are current
Bridge Income|Part-time or seasonal employment|Hourly employment while you build another path|Active|0|150|20|1|20|1200|3500|3|3|5|1|1|3|2|2|2|71|Explore|Apply to 5 schedule-compatible roles|May provide benefits or predictable cash flow
Bridge Income|Delivery / rideshare / task apps|On-demand local gig work|Active|50|800|250|1|20|800|3500|3|2|3|1|2|3|2|2|2.25|62|Explore|Run one shift and calculate net hourly earnings|Vehicle wear, fuel, insurance, and taxes matter
Freelance|Freelance writing / editing|Per-project content, editing, or documentation|Active|50|500|75|2|20|1500|8000|3|3|4|2|2|3|4|2|2.75|74|Explore|Create 2 samples and pitch 20 prospects|Niche expertise generally raises rates
Freelance|Graphic / presentation design|Design assets, decks, or brand materials|Active|100|1500|100|2|20|1500|10000|3|3|4|2|3|3|4|2|3|77|Explore|Offer one fixed-scope package|Software and portfolio costs vary
Freelance|Bookkeeping|Monthly bookkeeping for small businesses|Active|200|2500|150|4|20|2000|12000|3|3|4|3|3|3|4|3|3.25|76|Explore|Interview 5 business owners and offer a pilot|Training/certification can improve trust
Freelance|Virtual assistant / operations support|Remote admin, scheduling, research, and systems|Active|50|500|75|2|25|1600|7000|3|3|4|2|2|4|4|2|3|72|Explore|Define a 10-hour starter package|Can evolve into an agency
Freelance|Web development / no-code builds|Build or improve websites and automations|Active|100|2000|100|3|20|2500|15000|3|3|3|3|3|3|4|3|3.25|74|Explore|Build a one-page demo for a niche|Scope control is essential
Freelance|Data analysis / dashboard service|Reporting, spreadsheet, BI, or analytics projects|Active|100|1500|100|3|20|2500|15000|3|3|4|3|3|3|4|2|3|77|Explore|Create one before/after case study|Best with a clear industry niche
Consulting|Independent consulting|Sell specialized expertise to organizations|Active|200|3000|250|3|20|4000|25000|3|3|3|2|4|3|4|3|3.5|72|Explore|Package a paid diagnostic and contact 15 buyers|Professional insurance may be appropriate
Consulting|Fractional leadership|Part-time executive or functional leadership|Active|300|3000|250|4|20|5000|30000|3|3|3|2|4|3|4|3|3.5|71|Explore|Draft a 90-day outcomes offer|Credibility and network drive early sales
Consulting|Career coaching / resume services|Packages for job seekers or career changers|Active|100|2000|150|3|15|1500|10000|3|3|3|3|3|3|4|3|3.25|74|Explore|Run 5 interviews and sell a beta package|Avoid outcome guarantees
Teaching|Tutoring / test prep|Hourly or packaged academic support|Active|50|800|75|2|15|800|6000|3|3|4|2|2|3|3|2|2.5|71|Explore|Offer 3 paid trial sessions|Background checks or platform fees may apply
Teaching|Workshops / corporate training|Live training for companies or communities|Hybrid|200|2500|100|4|10|1000|15000|3|3|3|3|3|2|3|3|2.75|74|Explore|Pre-sell one 60-minute workshop|Reusable curriculum improves margins
Service Business|Cleaning service|Residential or commercial recurring cleaning|Active|300|3000|400|2|30|2500|15000|3|3|3|2|4|4|3|3|3.5|73|Explore|Quote 10 local prospects before buying equipment|Insurance, supplies, and labor are key costs
Service Business|Lawn care / property maintenance|Recurring exterior or light maintenance work|Active|500|8000|600|2|30|3000|20000|3|3|3|2|4|4|3|4|3.75|72|Explore|Pre-sell 3 routes using borrowed/rented tools|Seasonality and equipment transport matter
Service Business|Mobile detailing|Vehicle detailing at customer locations|Active|500|5000|350|2|25|2500|12000|3|3|3|2|4|4|3|3|3.5|73|Explore|Book 5 discounted launch customers|Confirm water, power, and local rules
Service Business|Pet care / dog walking|Walks, visits, sitting, or recurring pet support|Active|100|1500|150|1|20|1200|7000|3|3|4|2|3|3|3|2|2.75|73|Explore|Offer a paid trial to neighborhood clients|Insurance and trust are important
Service Business|Home organizing / move support|Decluttering, packing, setup, or move coordination|Active|100|1200|125|2|20|1500|9000|3|3|4|2|2|3|3|2|2.5|77|Explore|Sell a 3-hour starter session|Before/after portfolio helps
Service Business|Senior concierge / errand service|Non-medical errands, coordination, and companionship|Active|150|2000|200|3|20|1600|8000|3|3|3|2|3|3|3|3|3|70|Explore|Interview caregivers and test one service package|Check insurance, screening, and local requirements
Service Business|Handyman / furniture assembly|Small repairs, installs, and assembly|Active|300|5000|300|1|25|2500|12000|3|3|3|2|4|4|3|3|3.5|74|Explore|List 5 jobs you can perform safely and legally|Licensing rules vary by location and job size
Digital Product|Templates / spreadsheets / toolkits|Sell downloadable problem-solving assets|Passive|50|1000|75|6|10|100|6000|3|3|3|5|2|2|5|2|2.75|68|Explore|Pre-sell one template to 5 target users|Requires distribution and ongoing updates
Digital Product|Online course|Recorded lessons, cohort, or hybrid program|Hybrid|200|5000|200|10|15|200|15000|3|3|2|4|4|3|5|3|3.75|65|Explore|Pre-sell a live beta before recording|Course creation alone does not create demand
Digital Product|Paid newsletter / membership|Recurring subscription for valuable niche content|Hybrid|50|1500|100|12|10|100|10000|3|3|2|4|3|2|5|2|3|66|Explore|Publish 4 free issues and interview readers|Audience growth usually takes time
Content|Affiliate content site / channel|Commissions from referred purchases or leads|Passive|100|2500|150|20|12|0|10000|3|3|2|5|4|3|5|3|3.75|58|Explore|Publish 10 high-intent pieces in one niche|Platform and search changes create risk
Content|YouTube / podcast / sponsorships|Ads, sponsors, affiliates, products, and leads|Hybrid|100|5000|200|24|15|0|20000|3|3|2|4|5|3|5|3|4|56|Explore|Create a 6-episode minimum viable series|Income is usually slow and uneven at first
E-commerce|Print-on-demand shop|Sell designs without holding most inventory|Passive|100|1500|200|6|12|100|5000|3|3|2|4|3|3|4|2|3|62|Explore|Launch 10 designs and cap ad spend|Margins and platform fees can be significant
E-commerce|Reselling / flipping|Buy underpriced goods and resell for margin|Active|200|5000|300|1|15|500|8000|3|3|3|2|4|3|4|3|3.5|70|Explore|Flip 10 items with a strict buy budget|Track inventory, returns, shipping, and tax
E-commerce|Niche online store|Curated inventory, wholesale, or private-label products|Hybrid|1000|15000|1000|12|20|500|30000|3|3|2|3|5|3|4|4|4|61|Explore|Validate 20 preorders before inventory|Inventory and customer acquisition can consume cash
Software|Micro-SaaS / paid automation|Subscription software solving a narrow problem|Passive|300|10000|300|16|15|0|30000|3|3|2|5|5|3|5|5|4.5|59|Explore|Secure 5 design partners and a paid pilot|Support, security, and churn continue after launch
Assets|Rent a room / parking / storage|Earn from underused owned space|Passive|100|5000|150|3|3|300|3000|3|3|3|5|4|1|2|3|2.5|67|Explore|Check legal/lease rules and comparable prices|Insurance, taxes, HOA, and local rules vary
Assets|Equipment rental|Rent tools, camera, party, baby, or outdoor gear|Hybrid|500|10000|250|6|8|300|6000|3|3|2|4|5|2|2|4|3.25|63|Explore|List one existing asset and test demand|Damage, storage, maintenance, and insurance matter
Property|Long-term rental property|Rent residential property for cash flow|Passive|15000|100000|1200|24|5|-500|4000|3|3|1|5|5|2|3|5|3.75|45|Explore|Analyze 10 deals including vacancy and repairs|Large capital, leverage, and concentration risk
Property|Short-term rental management|Manage listings for owners for a fee|Hybrid|500|5000|300|6|15|1000|12000|3|3|2|3|4|3|3|5|3.75|67|Explore|Pitch management to 10 current hosts|Local restrictions and seasonality matter
Investing|Income-focused diversified portfolio|Interest/dividends from diversified investments|Passive|1000|100000|25|52|1|10|5000|3|3|2|5|5|1|1|5|3|51|Research|Model yield, taxes, volatility, and emergency fund|Not guaranteed; principal can decline; consider fiduciary advice
Acquisition|Buy a small existing business|Acquire operating cash flow and improve it|Hybrid|25000|500000|2500|20|40|2000|50000|3|3|1|3|5|5|4|5|4.75|50|Research|Review 20 listings and lender requirements|Requires deep diligence, capital, and operating capacity`;

const experiments = `Idea|Status|Start date|Decision date|Hypothesis|Test action|Budget|Hours|Leads|Replies|Sales|Revenue|Direct cost|Net cash|Net $/hr|Decision / learning
Sell unused items|Running|2026-08-13|2026-08-20|Five good listings will produce at least one sale|List 5 items and improve once after 48 hours|0|0|0|0|0|0|0|0||
Temporary/event work|Planned|2026-08-14|2026-08-24|Six targeted registrations/applications will generate a screening|Apply to 3 agencies and 3 venues|0|0|0|0|0|0|0|0||`;

const costs = `Income Path|Expense Category|Cost Type|Expense Item|Low Estimate|High Estimate|Actual|Essential?|Due / Start Date|Notes / Vendor
Example: Consulting|Legal / Admin|One-time|Business registration|100|500||Yes||Check state/local requirements
Example: Consulting|Insurance|Monthly|Professional liability|40|150||Yes||Get quotes before committing
Example: Consulting|Marketing|One-time|Basic website / portfolio|0|800||No||Start with a simple landing page
Example: Consulting|Software|Monthly|Core tools|20|150||Yes||Avoid overlapping subscriptions`;

export const SNAPSHOT_GUARDRAILS: Record<string, string | number> = {
  "monthly income needed": 5000,
  "cash available to start": 2000,
  "hours available per week": 30,
  "desired weeks to first income": 4,
  "risk tolerance (1-5)": 3,
  "preferred income style": "Hybrid",
  "preferred work setting": "Flexible",
  "skill fit weight": 5,
  "interest weight": 4,
  "risk comfort weight": 4,
  "passive potential weight": 2,
  "speed weight": 5,
  "income potential weight": 5,
  "low effort weight": 4,
};

export type SnapshotTable = { tab: "shortIdeas" | "longIdeas" | "experiments" | "costs"; rows: Array<Record<string, string>> };

export function normalizeHeader(h: string) {
  return h.replace(/[–—]/g, "-").replace(/ /g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function parse(text: string) {
  const [head, ...lines] = text.split("\n");
  const headers = head.split("|").map(normalizeHeader);
  return lines.filter(Boolean).map(line => {
    const cells = line.split("|");
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

export function snapshotTables(): SnapshotTable[] {
  return [
    { tab: "shortIdeas", rows: parse(shortIdeas) },
    { tab: "longIdeas", rows: parse(longIdeas) },
    { tab: "experiments", rows: parse(experiments) },
    { tab: "costs", rows: parse(costs) },
  ];
}
