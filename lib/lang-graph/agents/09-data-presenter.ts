import type { AgentNode } from "../graph-state/graph-state";

type PresentationSection = {
  title: string;
  keyFindings: string[];
  supportingData: string[];
  nextSteps: string;
};

type PresentationPayload = {
  executiveSummary: string;
  sections: PresentationSection[];
  appendices: string[];
};

export const dataPresenterAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const analysisComponents = Array.isArray(state.analysisResults?.components)
    ? state.analysisResults.components
    : [];

  const sections: PresentationSection[] = analysisComponents.map((component) => ({
    title: component.title,
    keyFindings: [
      "Highlight top three quantitative signals once analysis is complete.",
      "Surface qualitative themes that reinforce or challenge the data.",
    ],
    supportingData: component.inputs,
    nextSteps: "Convert preliminary findings into visuals (charts/tables) and draft narrative paragraphs for review.",
  }));

  const payload: PresentationPayload = {
    executiveSummary:
      "Draft concise executive summary once analyses finalize: capture market context, momentum indicators, and recommended actions.",
    sections,
    appendices: [
      "List of data sources with access notes.",
      "Methodology and assumptions log.",
      "Outstanding data gaps or expert follow-up actions.",
    ],
  };

  return {
    presentation: payload,
    executionHistory: [
      ...history,
      {
        agent: "data_presenter",
        timestamp: new Date(),
        status: "completed",
        output: `Prepared presentation scaffold with ${sections.length} section${sections.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
