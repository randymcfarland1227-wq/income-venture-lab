"use client";

import { BriefcaseBusiness, Megaphone, Palette } from "lucide-react";
import type { Idea } from "@/lib/domain";
import { DetailField, ModuleIntro } from "./common";

export function BusinessPlanModule({ idea }: { idea: Idea }) {
  return <><ModuleIntro icon={BriefcaseBusiness} title="Business Plan" description="Build the business as a coherent whole. These notes are the working plan—not a pitch-deck performance." /><div className="detail-grid three">
    <DetailField idea={idea} detail="businessSummary" label="Executive Summary" placeholder="What is the business, what does it sell, and why should it exist?" />
    <DetailField idea={idea} detail="mission" label="Mission" placeholder="What does this business do for people?" />
    <DetailField idea={idea} detail="vision" label="Vision" placeholder="What could this become over time?" />
    <DetailField idea={idea} detail="offer" label="Products / Offers" placeholder="What will be sold first, next, and later?" />
    <DetailField idea={idea} detail="advantage" label="Why This Can Win" placeholder="Distinctive advantage, insight, access, or capability" />
    <DetailField idea={idea} detail="operationsPlan" label="Operations" placeholder="Sourcing, production, fulfillment, service, systems, and people" />
    <DetailField idea={idea} detail="nearTermGoals" label="Next 90 Days" placeholder="The few outcomes that matter now" />
    <DetailField idea={idea} detail="openDecisions" label="Open Decisions" placeholder="Questions and choices that still need work" />
  </div></>;
}

export function BrandModule({ idea }: { idea: Idea }) {
  return <><ModuleIntro icon={Palette} title="Brand" description="Shape the meaning, personality, voice, and visual world people should recognize before you design individual assets." /><div className="detail-grid three">
    <DetailField idea={idea} detail="brandPositioning" label="Positioning" placeholder="For whom, in what category, and why this brand instead?" />
    <DetailField idea={idea} detail="brandPromise" label="Brand Promise" placeholder="The consistent experience customers should expect" />
    <DetailField idea={idea} detail="brandStory" label="Origin / Story" placeholder="The human story and reason behind the brand" />
    <DetailField idea={idea} detail="brandPersonality" label="Personality" placeholder="3–5 traits; what the brand is and is not" />
    <DetailField idea={idea} detail="brandVoice" label="Voice & Language" placeholder="How the brand sounds, phrases it owns, and tones to avoid" />
    <DetailField idea={idea} detail="visualDirection" label="Visual Direction" placeholder="Color, typography, imagery, materials, mood" />
    <DetailField idea={idea} detail="namingNotes" label="Naming System" placeholder="Company, collections, products, scents, or features" />
    <DetailField idea={idea} detail="packagingNotes" label="Packaging / Experience" placeholder="Unboxing, labels, inserts, presentation, and sensory details" />
  </div></>;
}

export function MarketingModule({ idea }: { idea: Idea }) {
  return <><ModuleIntro icon={Megaphone} title="Marketing" description="Turn the brand and offer into a practical path to attention, trust, launch, and repeat demand." /><div className="detail-grid three">
    <DetailField idea={idea} detail="primaryAudience" label="Primary Audience" placeholder="Who is most likely to care first?" />
    <DetailField idea={idea} detail="marketingObjectives" label="Objectives" placeholder="Awareness, email list, launch sales, repeat purchase…" />
    <DetailField idea={idea} detail="channelStrategy" label="Channels" placeholder="Where to show up and what each channel is for" />
    <DetailField idea={idea} detail="contentPillars" label="Content Pillars" placeholder="Repeatable themes and stories" />
    <DetailField idea={idea} detail="launchPlan" label="Launch Plan" placeholder="Audience building, pre-launch, launch, and follow-through" />
    <DetailField idea={idea} detail="campaignIdeas" label="Campaign Ideas" placeholder="Seasonal, product, story, or community campaigns" />
    <DetailField idea={idea} detail="partnershipsPlan" label="Partnerships" placeholder="Creators, retailers, events, communities, collaborators" />
    <DetailField idea={idea} detail="marketingMetrics" label="Measures That Matter" placeholder="Signals that tell you whether marketing is working" />
  </div></>;
}
