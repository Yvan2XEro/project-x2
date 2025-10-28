import { usedModel } from "@/lib/ai/server-models";
import { z } from "zod";
import { AgentNode, AgentStateType } from "../graph-state/graph-state";
import type {
  AnalysisComponent,
  PresentationPayload,
  PresentationSection,
  ProprietarySearchResult,
  SearchPlanSummary,
  SnowflakeSearchResult,
  UserFileInsight,
  WebSearchResult,
} from "../types";

const SectionSummarySchema = z.object({
  keyFindings: z.array(z.string()).describe("List of key findings for this section."),
});

const SectionNarrativeSchema = z.object({
  narrative: z.string().describe("Detailed narrative paragraph for the section."),
});

const ExecutiveSummarySchema = z.object({
  headline: z.string().describe("Catchy headline for the executive summary."),
  body: z.array(z.string()).describe("Paragraphs forming the main body of the executive summary."),
  highlights: z.array(z.string()).describe("Bulleted list of key highlights from the report."),
});

function formatSnowflakeForPrompt(results: SnowflakeSearchResult[]): string {
  if (!results.length) {
    return "No Snowflake results available.";
  }
  return results
    .slice(0, 2)
    .map((result) => {
      const sample = (result.rows ?? []).slice(0, 2);
      return `Section ${result.sectionTitle}: ${result.sql.slice(0, 140)}${
        result.sql.length > 140 ? "…" : ""
      }\nSample: ${JSON.stringify(sample, null, 2).slice(0, 400)}`;
    })
    .join("\n\n");
}

function formatWebForPrompt(results: WebSearchResult[]): string {
  if (!results.length) {
    return "No web summary was produced.";
  }
  return results
    .slice(0, 3)
    .map(
      (result, index) =>
        `${index + 1}. ${result.summary} (sources: ${result.sources.join(", ") || "n/a"})`
    )
    .join("\n");
}

function formatProprietaryForPrompt(results: ProprietarySearchResult[]): string {
  if (!results.length) {
    return "No proprietary dataset described.";
  }
  return results
    .slice(0, 3)
    .map(
      (result) =>
        `${result.dataset} (${result.availability}) – ${result.summary}. Steps: ${result.nextSteps}`
    )
    .join("\n");
}

function formatUserFilesForPrompt(results: UserFileInsight[]): string {
  if (!results.length) {
    return "No user files highlighted.";
  }
  return results
    .slice(0, 3)
    .map(
      (result) =>
        `${result.filename}: ${result.summary}${
          result.keyMetrics.length ? ` (metrics: ${result.keyMetrics.join(", ")})` : ""
        }`
    )
    .join("\n");
}

export const dataPresenterAgent: AgentNode = async (state: AgentStateType) => {
  const history = state.executionHistory ?? [];
  const analysisComponents = Array.isArray(state.analysisResults?.components)
    ? (state.analysisResults.components as AnalysisComponent[])
    : [];

  const searchSummary = (state.searchResults ?? null) as SearchPlanSummary | undefined;
  const snowflakeResults = searchSummary?.snowflake?.results ?? [];
  const webResults = searchSummary?.web ?? [];
  const proprietaryResults = searchSummary?.proprietary ?? [];
  const userFiles = searchSummary?.userFiles ?? [];

  const chatModel = usedModel;

  let generatedExecutiveSummary: z.infer<typeof ExecutiveSummarySchema> = {
    headline: "Preliminary executive summary",
    body: ["Unable to generate a detailed executive summary without concrete analysis results."],
    highlights: ["No key points identified."],
  };

  if (analysisComponents.length > 0 || snowflakeResults.length > 0) {
    try {
      const summaryPrompt = `
        User question: "${state.userInput}"

        Analysis synthesis:
        ${JSON.stringify(
          analysisComponents.map((component) => ({
            title: component.title,
            summary: component.analysisSummary,
            findings: component.preliminaryFindings,
            visualization: component.visualization,
          })),
          null,
          2
        )}

        Snowflake results:
        ${formatSnowflakeForPrompt(snowflakeResults)}

        Web insights:
        ${formatWebForPrompt(webResults)}

        Proprietary datasets:
        ${formatProprietaryForPrompt(proprietaryResults)}

        User files:
        ${formatUserFilesForPrompt(userFiles)}

        Produce a clear and compelling executive summary (headline, 1-2 paragraphs, 3-5 bullet points) suitable for a consulting report. Respond in English and rely only on the elements provided; only if none are available may you use your own domain knowledge.
      `;

      const structuredSummaryModel = chatModel.withStructuredOutput(ExecutiveSummarySchema);
      generatedExecutiveSummary = await structuredSummaryModel.invoke(summaryPrompt);
    } catch (_error) {
      generatedExecutiveSummary = {
        headline: "Executive summary to be completed",
        body: [
          "Analyses require manual review before forming an investment recommendation.",
        ],
        highlights: [
          "Conclusions pending validation of proprietary data.",
        ],
      };
    }
  }


  const sections: PresentationSection[] = await Promise.all(
    analysisComponents.map(async (component) => {
      let keyFindings: string[] = ["Unable to generate key points."];
      let narrative: string = "Unable to generate a narrative.";

      const sectionWeb = webResults.filter(
        (result) => result.sectionId === component.sectionId
      );
      const sectionProprietary = proprietaryResults.filter(
        (result) => result.sectionId === component.sectionId
      );
      const sectionFiles = userFiles.filter(
        (result) => result.sectionId === component.sectionId
      );
      const sectionSnowflake = snowflakeResults.filter(
        (result) => result.sectionId === component.sectionId
      );

      try {
        const sectionContext = `
          User question: "${state.userInput}"
          Section: "${component.title}" — ${component.description}
          Analysis summary: ${component.analysisSummary}
          Quantified takeaway: ${component.preliminaryFindings}
          Web: ${formatWebForPrompt(sectionWeb)}
          Proprietary: ${formatProprietaryForPrompt(sectionProprietary)}
          User files: ${formatUserFilesForPrompt(sectionFiles)}
          Snowflake: ${formatSnowflakeForPrompt(sectionSnowflake)}

          Provide two to three key messages, then a narrative paragraph that integrates the evidence. Respond in English.
        `;
        
        const structuredKeyFindingsModel = chatModel.withStructuredOutput(SectionSummarySchema);
        const findingsResult = await structuredKeyFindingsModel.invoke(`Generate key findings for "${component.title}" based on: ${sectionContext}`);
        keyFindings = findingsResult.keyFindings;
        const structuredNarrativeModel = chatModel.withStructuredOutput(SectionNarrativeSchema);
        const narrativeResult = await structuredNarrativeModel.invoke(`Generate the narrative for "${component.title}" based on: ${sectionContext}`);
        narrative = narrativeResult.narrative;
      } catch (_error) {
        keyFindings = [component.analysisSummary || component.preliminaryFindings];
        narrative = component.preliminaryFindings;
      }

      const supportingData = [
        ...component.inputs,
        ...sectionWeb.flatMap((result) => result.sources),
        ...sectionProprietary.map((result) => result.dataset),
        ...sectionFiles.map((result) => result.filename),
        ...sectionSnowflake.map((result) => result.sql.slice(0, 80)),
      ].filter(Boolean);

      const uniqueSupportingData = Array.from(new Set(supportingData));

      return {
        title: component.title,
        keyFindings,
        supportingData: uniqueSupportingData,
        nextSteps: narrative,
      };
    })
  );

  const payload: PresentationPayload = {
    executiveSummary: `${generatedExecutiveSummary.headline}\n\n${generatedExecutiveSummary.body.join("\n\n")}\n\nKey points:\n${generatedExecutiveSummary.highlights
      .map((highlight) => `- ${highlight}`)
      .join("\n")}`.trim(),
    sections,
    appendices: [
      "List of sources and access notes.",
      "Methodology log and assumptions.",
      "Follow-up actions or expert addenda.",
    ],
  };

  console.log("\n\n\n\nData presenter agent: ", JSON.stringify(payload));

  return {
    presentation: payload,
    executionHistory: [
      ...history,
      {
        agent: "data_presenter",
        timestamp: new Date(),
        status: "completed",
        output: `Prepared presentation content for ${sections.length} section${sections.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
