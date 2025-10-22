import type { AgentNode } from "../graph-state/graph-state";

type DataGap = {
  id: string;
  description: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

type DataGapSummary = {
  gaps: DataGap[];
  notes: string[];
};

export const expertInputRequiredAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const coverage = Array.isArray(state.searchResults?.coverage)
    ? state.searchResults.coverage
    : [];

  const gaps: DataGap[] = [];

  for (const section of coverage) {
    if (!section.unmetRequirements || section.unmetRequirements.length === 0) {
      continue;
    }

    gaps.push({
      id: section.sectionId,
      description: `Missing data for section "${section.sectionTitle}" (${section.unmetRequirements.join(", ")}).`,
      recommendedAction: "Escalate to subject-matter expert or internal knowledge base to source the missing metrics.",
      priority: "high",
    });
  }

  const summary: DataGapSummary = {
    gaps,
    notes:
      gaps.length === 0
        ? ["Current search plan covers all checklist requirements. Expert input optional at this stage."]
        : [
            `Identified ${gaps.length} high-priority gap${gaps.length === 1 ? "" : "s"}.`,
            "Document outstanding questions for potential Phase 4 expert community handoff.",
          ],
  };

  return {
    dataGaps: summary,
    executionHistory: [
      ...history,
      {
        agent: "expert_input_required",
        timestamp: new Date(),
        status: "completed",
        output:
          gaps.length === 0
            ? "No expert escalation required."
            : `Flagged ${gaps.length} potential expert follow-up${gaps.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
