import { normalizeUserInput } from "@/utils/normalize-user-input";
import type { AgentNode } from "../graph-state/graph-state";
import type { UserInput } from "./tiager-prompt-enhancer";

type SearchChannel = "web" | "proprietary" | "user_files";

type SearchTask = {
  id: string;
  channel: SearchChannel;
  target: string;
  query: string;
  rationale: string;
  expectedOutput: string;
};

type SectionCoverage = {
  sectionId: string;
  sectionTitle: string;
  plannedTasks: string[];
  unmetRequirements: string[];
};

type SearchPlan = {
  tasks: SearchTask[];
  coverage: SectionCoverage[];
};

function buildQueries(keywords: string[], requirement: string, geography: string): string {
  const base = requirement.replace(/^[^a-zA-Z0-9]+/g, "").trim();
  const focus = keywords.slice(0, 2).join(" ");

  return [base, geography, focus]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export const dataSearcherAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const connections = state.dataConnections?.connections ?? [];
  const manager = state.dataSources?.data_source_manager;
  const scopeSections = Array.isArray(state.scope?.sections)
    ? state.scope.sections
    : [];

  const keywords = Array.isArray(state.dataConnections?.context?.keywords)
    ? state.dataConnections.context.keywords
    : normalizeUserInput(state.userInput as UserInput)
        .split(/[,.;\n]/)
        .map((chunk) => chunk.trim().toLowerCase())
        .filter((chunk) => chunk.length > 4)
        .slice(0, 8);

  const geography = manager?.geography ?? "Global";

  const tasks: SearchTask[] = [];
  const coverage: SectionCoverage[] = [];

  for (const section of scopeSections) {
    const plannedTasks: string[] = [];
    const unmetRequirements: string[] = [];

    const requirements = Array.isArray(section.data_requirements)
      ? section.data_requirements
      : [];

    for (const requirement of requirements) {
      const query = buildQueries(keywords, requirement, geography);

      const proprietarySource = connections.find(
        (connection) => connection.status === "ready"
      );

      if (proprietarySource) {
        tasks.push({
          id: `${section.section_id}-proprietary-${tasks.length}`,
          channel: "proprietary",
          target: proprietarySource.name,
          query,
          rationale: `Aligns with ${section.title} requirement: ${requirement}.`,
          expectedOutput: "Structured dataset (CSV/JSON) with metrics covering the specified dimension.",
        });
        plannedTasks.push(`Proprietary: ${proprietarySource.name}`);
      } else {
        unmetRequirements.push(requirement);
      }

      tasks.push({
        id: `${section.section_id}-web-${tasks.length}`,
        channel: "web",
        target: "Trusted web",
        query: `${query} site:(${geography.toLowerCase()})`,
        rationale: `Supplement proprietary data with recent commentary for ${section.title}.`,
        expectedOutput: "Articles, reports, or press releases published within the last 24 months.",
      });
      plannedTasks.push("Web: scoped query");
    }

    coverage.push({
      sectionId: section.section_id,
      sectionTitle: section.title,
      plannedTasks,
      unmetRequirements,
    });
  }

  const plan: SearchPlan = {
    tasks,
    coverage,
  };

  return {
    searchResults: plan,
    executionHistory: [
      ...history,
      {
        agent: "data_searcher",
        timestamp: new Date(),
        status: "completed",
        output: `Prepared ${tasks.length} search task${tasks.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
