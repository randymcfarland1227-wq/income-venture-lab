"use client";

import type { ReactNode } from "react";
import type { Idea, IdeaDetails } from "@/lib/domain";
import { useLab } from "../store";
import { Editable } from "../ui";

export function useIdeaSave(idea: Idea) {
  const { update } = useLab();
  return {
    field: (key: keyof Idea) => (value: string | number | null) => update("ideas", idea.id, { [key]: value }),
    detail: (key: keyof IdeaDetails) => (value: string | number | null) =>
      update("ideas", idea.id, { details: { ...idea.details, [key]: value === null ? "" : String(value) } }),
  };
}

/** A labeled long-text field that saves on blur — the workspace's basic writing surface. */
export function DetailField({ idea, detail, label, placeholder }: { idea: Idea; detail: keyof IdeaDetails; label: string; placeholder?: string }) {
  const save = useIdeaSave(idea);
  return (
    <div className="detail-field">
      <Editable label={label} type="textarea" value={idea.details[detail] ?? ""} placeholder={placeholder ?? "Add notes"} onSave={save.detail(detail)} />
    </div>
  );
}

export function ModuleIntro({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="module-intro">
      <span className="area-icon"><Icon /></span>
      <div className="min-w-0 flex-1">
        <h2 className="module-title">{title}</h2>
        <p className="module-lede">{description}</p>
      </div>
      {action}
    </div>
  );
}
