import { myProvider } from "@/lib/ai/providers";
import { generateText } from "ai";
import { z } from "zod";
import type { AgentNode } from "../graph-state/graph-state";
import type {
  AnalysisComponent,
  AnalysisSummary,
  ProprietarySearchResult,
  DataConnection,
  ScopeSection,
  SearchPlanSummary,
  SnowflakeSearchResult,
  SearchTask,
  UserFileInsight,
  WebSearchResult,
} from "../types";
import { isDataConnection, isScopeSection, isSearchTask } from "../utils/type-guards";

const analysisSchema = z.object({
  preliminaryFindings: z.string(),
  analysisSummary: z.string(),
  quantInsights: z.array(z.string()).optional(),
  visualizationIdeas: z.array(z.string()).optional(),
});

type SectionContext = {
  section: ScopeSection;
  approachHint: string;
  inputs: string[];
  web: WebSearchResult[];
  proprietary: ProprietarySearchResult[];
  userFiles: UserFileInsight[];
  snowflake: SnowflakeSearchResult[];
};

type LanguageModel = ReturnType<typeof myProvider.languageModel>;

function stripJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function buildSectionContext(args: {
  section: ScopeSection;
  tasks: SearchTask[];
  connections: DataConnection[];
  searchResults: SearchPlanSummary | undefined;
}): SectionContext {
  const { section, tasks, connections, searchResults } = args;

  const sectionTasks = tasks.filter((task) => task.id.startsWith(section.section_id));
  const referencedSources = sectionTasks
    .map((task) => `${task.channel}:${task.target}`)
    .slice(0, 6);

  const preferredConnection = connections.find((connection) =>
    sectionTasks.some((task) => task.target === connection.name)
  );

  const inputs = [
    ...(preferredConnection ? [preferredConnection.name] : []),
    ...referencedSources,
  ];

  const web = (searchResults?.web ?? []).filter(
    (result) => result.sectionId === section.section_id
  );
  const proprietary = (searchResults?.proprietary ?? []).filter(
    (result) => result.sectionId === section.section_id
  );
  const userFiles = (searchResults?.userFiles ?? []).filter(
    (result) => result.sectionId === section.section_id
  );
  const snowflake = searchResults?.snowflake?.results
    ? searchResults.snowflake.results.filter(
        (result) => result.sectionId === section.section_id
      )
    : [];

  const approachHint = `Analyze ${section.title.toLowerCase()} by combining quantitative data and qualitative signals.`;

  return {
    section,
    approachHint,
    inputs,
    web,
    proprietary,
    userFiles,
    snowflake,
  };
}

function serializeRows(rows: SnowflakeSearchResult[]): string {
  if (rows.length === 0) {
    return "No confirmed SQL extraction.";
  }

  const previews = rows.slice(0, 2).map((result) => {
    const sample = (result.rows ?? []).slice(0, 3);
    const serialized = JSON.stringify(sample, null, 2).slice(0, 700);
    return `SQL: ${result.sql.slice(0, 160)}${result.sql.length > 160 ? "…" : ""}\nExtract: ${serialized}`;
  });

  return previews.join("\n---\n");
}

function buildEvidenceBlock(context: SectionContext): string {
  const lines: string[] = [];

  if (context.web.length > 0) {
    lines.push(
      "Web insights:\n" +
        context.web
          .map((result, index) => {
            const snippet = result.snippets.at(0) ?? result.summary;
            return `${index + 1}. ${snippet}\nSources: ${result.sources.join(", ")}`;
          })
          .join("\n")
    );
  }

  if (context.proprietary.length > 0) {
    lines.push(
      "Proprietary datasets:\n" +
        context.proprietary
          .map((result) => `${result.dataset} (${result.availability}) — ${result.summary}`)
          .join("\n")
    );
  }

  if (context.userFiles.length > 0) {
    lines.push(
      "User files:\n" +
        context.userFiles
          .map((result) => `${result.filename}: ${result.summary}`)
          .join("\n")
    );
  }

  if (context.snowflake.length > 0) {
    lines.push(`Snowflake probes:\n${serializeRows(context.snowflake)}`);
  }

  return lines.join("\n\n") || "No supporting evidence provided.";
}

async function analyseSectionContext({
  context,
  model,
}: {
  context: SectionContext;
  model: LanguageModel;
}): Promise<AnalysisComponent> {
  const dataRequirements = Array.isArray(context.section.data_requirements)
    ? context.section.data_requirements.join("; ")
    : "";

  const evidence = buildEvidenceBlock(context);
  const languageInstruction = "Respond in professional English.";

  const prompt = [
    "You are a senior consultant tasked with synthesizing the analyses.",
    languageInstruction,
    `Section: ${context.section.title}`,
    context.section.description ? `Description: ${context.section.description}` : "",
    context.approachHint,
    dataRequirements ? `Data requirements: ${dataRequirements}` : "",
    "Available data and signals:",
    evidence,
    "Provide strict JSON output with the keys: preliminaryFindings (string), analysisSummary (string), quantInsights (string[]), visualizationIdeas (string[]).",
    "Ground the conclusions in evidence and reference quantitative indicators when available. Flag any hypothetical data explicitly.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { text } = await generateText({
      model,
      temperature: 0.35,
      maxOutputTokens: 700,
      prompt,
    });
    const parsed = analysisSchema.parse(
      JSON.parse(stripJson(text || "{}"))
    );

    const visualization = parsed.visualizationIdeas?.at(0)
      ? parsed.visualizationIdeas.join(" | ")
      : "Graph combining time series and annotated commentary.";

    const idSet = new Set<string>(context.inputs);
    for (const result of context.web) {
      result.sources.forEach((source) => idSet.add(`web:${source}`));
    }
    for (const result of context.proprietary) {
      idSet.add(`dataset:${result.dataset}`);
    }
    for (const file of context.userFiles) {
      idSet.add(`file:${file.filename}`);
    }
    for (const probe of context.snowflake) {
      idSet.add(`sql:${probe.sql.slice(0, 40)}`);
    }

    return {
      sectionId: context.section.section_id,
      title: context.section.title,
      approach: context.approachHint,
      inputs: Array.from(idSet),
      preliminaryFindings: parsed.preliminaryFindings,
      analysisSummary: parsed.analysisSummary,
      visualization,
      description: context.section.description ?? "",
    };
  } catch (error) {
    return {
      sectionId: context.section.section_id,
      title: context.section.title,
      approach: context.approachHint,
      inputs: context.inputs,
      preliminaryFindings:
        "Qualitative analysis pending. Data is insufficient for verified conclusions.",
      analysisSummary: `Interim summary for ${context.section.title}.`,
      visualization:
        "Comparative table listing available indicators and missing sources.",
      description: context.section.description ?? "",
    };
  }
}

export const dataAnalyzerAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const sections: ScopeSection[] = Array.isArray(state.scope?.sections)
    ? state.scope.sections.filter(isScopeSection)
    : [];
  const rawConnections = state.dataConnections?.connections;
  const connections = Array.isArray(rawConnections)
    ? rawConnections.filter(isDataConnection)
    : [];
  const searchResults = (state.searchResults ?? null) as SearchPlanSummary | undefined;
  const searchTasks: SearchTask[] = Array.isArray(searchResults?.tasks)
    ? searchResults.tasks.filter(isSearchTask)
    : [];

  const analysisModel = myProvider.languageModel("chat-model");
  const modelId = analysisModel.modelId ?? "chat-model";
  const sectionContexts: SectionContext[] = sections.map((section) =>
    buildSectionContext({
      section,
      tasks: searchTasks,
      connections,
      searchResults,
    })
  );

  const components: AnalysisComponent[] = await Promise.all(
    sectionContexts.map((context) =>
      analyseSectionContext({
        context,
        model: analysisModel,
      })
    )
  );

  const summary: AnalysisSummary = {
    components,
    notes: [
      `Analysis generated with model ${modelId}.`,
      "Track documented assumptions and validate key metrics against proprietary sources.",
    ],
  };

  console.log("\n\n\n\nData analyzer agent: ", JSON.stringify(summary));

  return {
    analysisResults: summary,
    executionHistory: [
      ...history,
      {
        agent: "data_analyzer",
        timestamp: new Date(),
        status: "completed",
        output: `Analyzed ${components.length} section${components.length === 1 ? "" : "s"} with ${modelId}.`,
      },
    ],
  };
};
