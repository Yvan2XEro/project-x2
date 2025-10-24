import { myProvider } from "@/lib/ai/providers";
import { generateText } from "ai";
import { z } from "zod";
import type { AgentNode } from "../graph-state/graph-state";
import type {
  AnalysisComponent,
  AnalysisSummary,
  ProprietarySearchResult,
  SearchPlanSummary,
  SnowflakeSearchResult,
  UserFileInsight,
  WebSearchResult,
} from "../types";

const analysisSchema = z.object({
  preliminaryFindings: z.string(),
  analysisSummary: z.string(),
  quantInsights: z.array(z.string()).optional(),
  visualizationIdeas: z.array(z.string()).optional(),
});

type SectionContext = {
  section: any;
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
  section: any;
  tasks: any[];
  connections: any[];
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

  const approachHint = `Analyse ${section.title.toLowerCase()} en combinant données quantitatives et signaux qualitatifs.`;

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
    return "Aucune extraction SQL confirmée.";
  }

  const previews = rows.slice(0, 2).map((result) => {
    const sample = (result.rows ?? []).slice(0, 3);
    const serialized = JSON.stringify(sample, null, 2).slice(0, 700);
    return `SQL: ${result.sql.slice(0, 160)}${result.sql.length > 160 ? "…" : ""}\nExtrait: ${serialized}`;
  });

  return previews.join("\n---\n");
}

function buildEvidenceBlock(context: SectionContext): string {
  const lines: string[] = [];

  if (context.web.length > 0) {
    lines.push(
      "Insights web:\n" +
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
      "Datasets propriétaires:\n" +
        context.proprietary
          .map((result) => `${result.dataset} (${result.availability}) — ${result.summary}`)
          .join("\n")
    );
  }

  if (context.userFiles.length > 0) {
    lines.push(
      "Fichiers utilisateur:\n" +
        context.userFiles
          .map((result) => `${result.filename}: ${result.summary}`)
          .join("\n")
    );
  }

  if (context.snowflake.length > 0) {
    lines.push(`Probes Snowflake:\n${serializeRows(context.snowflake)}`);
  }

  return lines.join("\n\n") || "Aucun élément probant transmis.";
}

async function analyseSectionContext({
  context,
  model,
  locale,
}: {
  context: SectionContext;
  model: LanguageModel;
  locale: string;
}): Promise<AnalysisComponent> {
  const dataRequirements = Array.isArray(context.section.data_requirements)
    ? context.section.data_requirements.join("; ")
    : "";

  const evidence = buildEvidenceBlock(context);
  const languageInstruction = locale.startsWith("fr")
    ? "Réponds en français professionnel."
    : "Respond in professional English.";

  const prompt = [
    "Tu es un consultant senior chargé de synthétiser les analyses.",
    languageInstruction,
    `Section: ${context.section.title}`,
    context.section.description ? `Description: ${context.section.description}` : "",
    context.approachHint,
    dataRequirements ? `Exigences de données: ${dataRequirements}` : "",
    "Données et signaux disponibles:",
    evidence,
    "Fournis une sortie JSON stricte avec les clés: preliminaryFindings (string), analysisSummary (string), quantInsights (string[]), visualizationIdeas (string[]).",
    "Les conclusions doivent être argumentées et mentionner les indicateurs chiffrés lorsque disponibles. Si la donnée est hypothétique, précise-le explicitement.",
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
      : "Graphique combinant séries temporelles et commentaires annotés.";

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
        "Analyse qualitative à compléter. Données insuffisantes pour des conclusions vérifiées.",
      analysisSummary: `Synthèse provisoire pour ${context.section.title}.`,
      visualization:
        "Tableau comparatif listant les indicateurs disponibles et les sources manquantes.",
      description: context.section.description ?? "",
    };
  }
}

export const dataAnalyzerAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const sections = Array.isArray(state.scope?.sections)
    ? state.scope.sections
    : [];
  const connections = state.dataConnections?.connections ?? [];
  const searchResults = (state.searchResults ?? null) as SearchPlanSummary | undefined;
  const searchTasks = Array.isArray(searchResults?.tasks) ? searchResults.tasks : [];

  const analysisModel = myProvider.languageModel("chat-model");
  const modelId = analysisModel.modelId ?? "chat-model";
  const locale =
    state.userProfile && typeof state.userProfile === "object" && "locale" in state.userProfile
      ? (state.userProfile as { locale?: string }).locale ?? "fr-FR"
      : "fr-FR";

  const sectionContexts = sections.map((section) =>
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
        locale,
      })
    )
  );

  const summary: AnalysisSummary = {
    components,
    notes: [
      `Analyse générée avec le modèle ${modelId}.`,
      "Tracer les hypothèses retenues et valider les métriques clés auprès des sources propriétaires.",
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
        output: `Analysed ${components.length} section${components.length === 1 ? "" : "s"} avec ${modelId}.`,
      },
    ],
  };
};
