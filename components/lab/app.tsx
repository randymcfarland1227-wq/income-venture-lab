"use client";

import { Toaster } from "sonner";
import { AddIdeaDialog } from "./add-idea";
import { SearchPalette } from "./search";
import { Shell } from "./shell";
import { LabProvider, useLab } from "./store";
import { OverviewPage } from "./pages/overview";
import { ShortTermPage } from "./pages/short-term";
import { LongTermPage } from "./pages/long-term";
import { VenturesPage } from "./pages/ventures";
import { PassivePage } from "./pages/passive";
import { ExperimentsPage } from "./pages/experiments";
import { FinancialsPage } from "./pages/financials";
import { DiscoveryPage } from "./pages/discovery";
import { SyncPage } from "./pages/sync";
import { ArchivePage } from "./pages/archive";
import { Workspace } from "./workspace/workspace";

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
    case "short-term": return <ShortTermPage tab={route.sub} />;
    case "long-term": return <LongTermPage tab={route.sub} />;
    case "ventures": return <VenturesPage />;
    case "passive": return <PassivePage />;
    case "experiments": return <ExperimentsPage />;
    case "financials": return <FinancialsPage />;
    case "discovery": return <DiscoveryPage tab={route.sub} />;
    case "sync": return <SyncPage />;
    case "archive": return <ArchivePage />;
    default: return <OverviewPage />;
  }
}
