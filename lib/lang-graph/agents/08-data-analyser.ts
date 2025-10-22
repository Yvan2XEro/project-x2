import type { AgentNode } from "../graph-state/graph-state";

type AnalysisComponent = {
  sectionId: string;
  title: string;
  approach: string;
  inputs: string[];
  preliminaryFindings: string;
  visualization: string;
};

type AnalysisSummary = {
  components: AnalysisComponent[];
  notes: string[];
};

export const dataAnalyzerAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const sections = Array.isArray(state.scope?.sections)
    ? state.scope.sections
    : [];
  const connections = state.dataConnections?.connections ?? [];
  const searchTasks = Array.isArray(state.searchResults?.tasks)
    ? state.searchResults.tasks
    : [];

  const components: AnalysisComponent[] = sections.map((section) => {
    const relevantTasks = searchTasks
      .filter((task) => task.id.startsWith(section.section_id))
      .map((task) => `${task.channel} – ${task.target}`);

    const preferredSource = connections.find((connection) =>
      relevantTasks.some((task) => task.includes(connection.name))
    );

    const approach = `Synthesize quantitative indicators with qualitative insights for ${section.title.toLowerCase()}.`;
    const inputs = [
      ...(preferredSource ? [preferredSource.name] : []),
      ...relevantTasks,
    ];

    return {
      sectionId: section.section_id,
      title: section.title,
      approach,
      inputs,
      preliminaryFindings:
        "Pending data ingestion – prepare to calculate growth rates, benchmark comparisons, and key ratios aligned with SMART metrics.",
      visualization:
        "Suggest combo chart blending quantitative trend line with annotated qualitative highlights.",
    };
  });

  const summary: AnalysisSummary = {
    components,
    notes: [
      "Ensure raw datasets are validated before modelling.",
      "Document assumptions and transformation steps for auditability.",
    ],
  };

  return {
    analysisResults: summary,
    executionHistory: [
      ...history,
      {
        agent: "data_analyzer",
        timestamp: new Date(),
        status: "completed",
        output: `Outlined ${components.length} analysis component${components.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
