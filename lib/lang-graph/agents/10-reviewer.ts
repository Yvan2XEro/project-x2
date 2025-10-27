import type { AgentNode } from "../graph-state/graph-state";
import type { DataConnection, SectionCoverage } from "../types";
import { isDataConnection, isSectionCoverage } from "../utils/type-guards";

export const reviewerAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const coverage: SectionCoverage[] = Array.isArray(state.searchResults?.coverage)
    ? state.searchResults.coverage.filter(isSectionCoverage)
    : [];
  const dataGapsCount = Array.isArray(state.dataGaps?.gaps)
    ? state.dataGaps.gaps.length
    : 0;
  const presentationSections = Array.isArray(state.presentation?.sections)
    ? state.presentation.sections.length
    : 0;
  const connections: DataConnection[] = Array.isArray(
    state.dataConnections?.connections
  )
    ? state.dataConnections.connections.filter(isDataConnection)
    : [];

  const coveredSections = coverage.filter(
    (section) => !section.unmetRequirements || section.unmetRequirements.length === 0
  ).length;
  const totalSections = coverage.length || 1;
  const checklistCompletion = coveredSections / totalSections;

  const trustedSourcesUsed = connections.some(
    (connection) => connection.trustLevel === "verified"
  );

  const formatCorrect = presentationSections > 0;

  const scores = [
    checklistCompletion,
    trustedSourcesUsed ? 1 : 0,
    formatCorrect ? 1 : 0,
    dataGapsCount === 0 ? 1 : 0.8,
  ];

  const qualityScore = Number(
    (scores.reduce((acc, value) => acc + value, 0) / scores.length).toFixed(2)
  );

  const revisions: string[] = [];

  if (checklistCompletion < 1) {
    revisions.push("Resolve outstanding checklist items before final sign-off.");
  }
  if (dataGapsCount > 0) {
    revisions.push("Coordinate with expert community to address flagged data gaps.");
  }
  if (!formatCorrect) {
    revisions.push("Populate executive summary and analytical sections before release.");
  }

  const review = {
    checklist_completion: Number(checklistCompletion.toFixed(2)),
    data_gaps_identified: dataGapsCount > 0,
    trusted_sources_used: trustedSourcesUsed,
    format_correct: formatCorrect,
    quality_score: qualityScore,
    revisions_needed: revisions,
  };

  return {
    review,
    executionHistory: [
      ...history,
      {
        agent: "reviewer",
        timestamp: new Date(),
        status: "completed",
        output: review,
      },
    ],
  };
};
