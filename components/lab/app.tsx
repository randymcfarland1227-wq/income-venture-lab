"use client";

import { Toaster } from "sonner";
import { AddIdeaDialog } from "./add-idea";
import { SearchPalette } from "./search";
import { Shell } from "./shell";
import { LabProvider, useLab } from "./store";
import { OverviewPage } from "./pages/overview";
import { ShortTermPage } from "./pages/short-term";
import { LongTermPage } from "./pages/long-term";
import { ExperimentsPage } from "./pages/experiments";
import { FinancialsPage } from "./pages/financials";
import { DiscoveryPage } from "./pages/discovery";
import { SyncPage } from "./pages/sync";
import { ArchivePage } from "./pages/archive";
import { Workspace } from "./workspace/workspace";
import { InvestingPage } from "./pages/investing";
import { InvestmentWorkspace } from "./workspace/investment-workspace";
import { OpportunitiesPage } from "./pages/opportunities";
import { BusinessesPage } from "./pages/businesses";
import { IdeasInventionsPage } from "./pages/ideas-inventions";

export function IncomeLab() {
  return (
    <LabProvider>
      <Shell>
        <Router />
      </Shell>
      <AddIdeaDialog />
      <SearchPalette />
      <Toaster position="bottom-right" toastOptions={{ className: "lab-toast" }} />
    </LabProvider>
  );
}

function Router() {
  const { state, error, route } = useLab();

  if (!state) {
    return error ? (
      <div className="load-error">
        <p className="eyebrow">Couldn’t open the lab</p>
        <p className="mt-3 text-lg">{error}</p>
      </div>
    ) : (
      <div className="loading" aria-busy="true">
        <span className="loading-mark" />
        <p>Opening your lab…</p>
      </div>
    );
  }

  switch (route.page) {
    case "idea": return <Workspace ideaId={route.id ?? ""} module={route.module} />;
    case "investment": return <InvestmentWorkspace investmentId={route.id ?? ""} module={route.module} />;
    case "opportunities": return <OpportunitiesPage tab={route.sub} />;
    case "businesses": return <BusinessesPage tab={route.sub} />;
    case "ideas": return <IdeasInventionsPage tab={route.sub} />;
    // Preserve old bookmarks while routing them into the new unified lenses.
    case "short-term": return route.sub ? <ShortTermPage tab={route.sub} /> : <OpportunitiesPage tab="near-term" />;
    case "long-term": return route.sub ? <LongTermPage tab={route.sub} /> : <OpportunitiesPage tab="long-term" />;
    case "passive": return <OpportunitiesPage tab="passive" />;
    case "ventures": return <BusinessesPage tab={route.sub === "vault" ? "ideas" : route.sub === "pipeline" ? "ideas" : "active"} />;
    case "investing": return <InvestingPage tab={route.sub} />;
    case "experiments": return <ExperimentsPage />;
    case "financials": return <FinancialsPage />;
    case "discovery": return <DiscoveryPage tab={route.sub} />;
    case "sync": return <SyncPage />;
    case "archive": return <ArchivePage />;
    default: return <OverviewPage />;
  }
}
