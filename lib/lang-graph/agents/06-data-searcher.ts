import { myProvider } from "@/lib/ai/providers";
import {
  ensureSnowflakeConnection,
  executeSnowflakeQuery,
  getSnowflakeStatus,
} from "@/lib/services/snowflake";
import { normalizeUserInput } from "@/utils/normalize-user-input";
import { generateText } from "ai";
import { z } from "zod";
import type { AgentNode } from "../graph-state/graph-state";
import type {
  ProprietarySearchResult,
  SearchPlanSummary,
  SnowflakeSearchResult,
  SnowflakeSearchSummary,
  UserFileInsight,
  WebSearchResult,
} from "../types";
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

const MAX_SNOWFLAKE_QUERIES = 3;

type SnowflakeContext = {
  requirement: string;
  sectionTitle: string;
  sectionDescription: string;
  geography: string;
  keywords: string[];
  datasetHints: string[];
};

type WebResearchContext = {
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  requirement: string;
  query: string;
  geography: string;
};

type ProprietaryResearchContext = {
  sectionId: string;
  sectionTitle: string;
  requirement: string;
  sourceId: string;
  sourceName: string;
  datasetName: string;
  datasetSummary: string;
  accessStatus: "available" | "requires_access";
};

type UserFileContext = {
  sectionId: string;
  sectionTitle: string;
  filename: string;
  description: string;
};

const webResultSchema = z.object({
  summary: z.string(),
  snippets: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

const webSummarySchema = z.object({
  summary: z.string(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

const proprietaryResultSchema = z.object({
  summary: z.string(),
  nextSteps: z.string().optional(),
});

const userFileInsightSchema = z.object({
  summary: z.string(),
  keyMetrics: z.array(z.string()).optional(),
});

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

type SerpOrganicResult = {
  title: string;
  snippet: string;
  link: string;
};

const serpApiKey = process.env.SERPAPI_API_KEY ?? "";

async function generateSnowflakeSql({
  requirement,
  sectionTitle,
  sectionDescription,
  geography,
  keywords,
  datasetHints,
}: SnowflakeContext): Promise<string | null> {
  const keywordList = keywords.slice(0, 5).join(", ");
  const datasetLine = datasetHints.length
    ? `Preferred datasets: ${datasetHints.join(" | ")}`
    : "";

  const prompt = [
    "You are a Snowflake SQL assistant. Return only a valid Snowflake SQL query.",
    `Section: ${sectionTitle}`,
    sectionDescription ? `Section background: ${sectionDescription}` : "",
    `Requirement: ${requirement}`,
    datasetLine,
    `Geography or filter: ${geography}`,
    keywordList ? `Relevant keywords: ${keywordList}` : "",
    "The query must select structured columns with explicit aliases and stay within 90 days of data freshness when applicable.",
    "Return only the SQL statement without commentary or markdown fences.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      temperature: 0.2,
      maxOutputTokens: 400,
      prompt,
    });

    const cleaned = text
      .trim()
      .replace(/^```sql\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    return cleaned.length > 0 ? cleaned : null;
  } catch (error) {
    return null;
  }
}

function buildQueries(keywords: string[], requirement: string, geography: string): string {
  const base = requirement.replace(/^[^a-zA-Z0-9]+/g, "").trim();
  const focus = keywords.slice(0, 2).join(" ");

  return [base, geography, focus]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function fetchSerpResults(context: WebResearchContext): Promise<SerpOrganicResult[]> {
  if (!serpApiKey) {
    return [];
  }

  const params = new URLSearchParams({
    engine: "google",
    q: context.query,
    api_key: serpApiKey,
    hl: "fr",
  });

  if (context.geography) {
    params.set("gl", context.geography.slice(0, 2).toLowerCase());
    params.set("location", context.geography);
  }

  const endpoint = `https://serpapi.com/search.json?${params.toString()}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
    };

    const organic = payload.organic_results ?? [];

    return organic
      .filter((result) => Boolean(result.title) && Boolean(result.snippet) && Boolean(result.link))
      .slice(0, 5)
      .map((result) => ({
        title: result.title as string,
        snippet: result.snippet as string,
        link: result.link as string,
      }));
  } catch (error) {
    return [];
  }
}

async function summariseSerpResults({
  context,
  results,
}: {
  context: WebResearchContext;
  results: SerpOrganicResult[];
}): Promise<{ summary: string; confidence: "high" | "medium" | "low" }> {
  if (!results.length) {
    return {
      summary: `Aucune donnée publique confirmée pour ${context.sectionTitle}.`,
      confidence: "low",
    };
  }

  const prompt = [
    "Tu es un analyste de veille stratégique. Résume les informations suivantes issues d'une recherche Google.",
    `Section concernée: ${context.sectionTitle}`,
    context.sectionDescription ? `Contexte: ${context.sectionDescription}` : "",
    `Requête: ${context.query}`,
    "Résultats:",
    JSON.stringify(results, null, 2),
    "Produis un JSON strict { \"summary\": string, \"confidence\": \"high\"|\"medium\"|\"low\" } en français. Mentionne les tendances majeures et reste factuel.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 350,
    });

    const parsed = webSummarySchema.parse(
      JSON.parse(stripCodeFences(text || "{}"))
    );
    return {
      summary: parsed.summary,
      confidence: parsed.confidence ?? "medium",
    };
  } catch (error) {
    return {
      summary: `${context.sectionTitle}: synthèse automatisée à confirmer (basée sur ${results.length} résultats).`,
      confidence: "medium",
    };
  }
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
  const activeSnowflakeConnection = await ensureSnowflakeConnection();
  const snowflakeStatus = getSnowflakeStatus();
  const snowflakeResults: SnowflakeSearchResult[] = [];
  const webContexts: WebResearchContext[] = [];
  const proprietaryContexts: ProprietaryResearchContext[] = [];
  const userFileContexts: UserFileContext[] = [];
  let executedSnowflakeQueries = 0;

  for (const section of scopeSections) {
    const plannedTasks: string[] = [];
    const unmetRequirements: string[] = [];

    const requirements = Array.isArray(section.data_requirements)
      ? section.data_requirements
      : [];

    for (const requirement of requirements) {
      const query = buildQueries(keywords, requirement, geography);

      const proprietarySource =
        connections.find((connection) => connection.sourceId === "snowflake-marketplace") ??
        connections.find((connection) => connection.status === "ready") ??
        connections.find((connection) => connection.status === "requires_credentials");

      if (proprietarySource) {
        const expectedOutput =
          proprietarySource.sourceId === "snowflake-marketplace"
            ? "Snowflake data share delivering structured tables ready for modelling."
            : "Structured dataset (CSV/JSON) with metrics covering the specified dimension.";

        const rationaleSuffix =
          proprietarySource.status === "requires_credentials"
            ? " (access coordination required before extraction)."
            : ".";

        tasks.push({
          id: `${section.section_id}-proprietary-${tasks.length}`,
          channel: "proprietary",
          target: proprietarySource.name,
          query,
          rationale: `Aligns with ${section.title} requirement: ${requirement}${rationaleSuffix}`,
          expectedOutput,
        });
        plannedTasks.push(`Proprietary: ${proprietarySource.name}`);

        const datasetDescriptor = Array.isArray(proprietarySource.datasets)
          ? proprietarySource.datasets.at(0)
          : undefined;

        proprietaryContexts.push({
          sectionId: section.section_id,
          sectionTitle: section.title,
          requirement,
          sourceId: proprietarySource.sourceId,
          sourceName: proprietarySource.name,
          datasetName: datasetDescriptor?.title ?? proprietarySource.name,
          datasetSummary:
            datasetDescriptor?.description ??
            (proprietarySource.notes ?? "Dataset décrit par l'équipe data."),
          accessStatus:
            proprietarySource.status === "requires_credentials"
              ? "requires_access"
              : "available",
        });
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

      webContexts.push({
        sectionId: section.section_id,
        sectionTitle: section.title,
        sectionDescription: section.description,
        requirement,
        query: `${query} ${section.title}`.trim(),
        geography,
      });

      if (activeSnowflakeConnection && executedSnowflakeQueries < MAX_SNOWFLAKE_QUERIES) {
        const datasetHints = connections
          .flatMap((connection) => connection.datasets ?? [])
          .filter((dataset) => dataset.url && dataset.url.includes("snowflake"))
          .map((dataset) => `${dataset.title}: ${dataset.description}`)
          .slice(0, 3);

        const sql = await generateSnowflakeSql({
          requirement,
          sectionTitle: section.title,
          sectionDescription: section.description,
          geography,
          keywords,
          datasetHints,
        });

        if (sql) {
          executedSnowflakeQueries += 1;

          try {
            const rows = await executeSnowflakeQuery(sql, [], { rowLimit: 25 });
            snowflakeResults.push({
              sectionId: section.section_id,
              sectionTitle: section.title,
              requirement,
              sql,
              rows,
            });
            plannedTasks.push("Snowflake: executed SQL probe");
          } catch (error) {
            snowflakeResults.push({
              sectionId: section.section_id,
              sectionTitle: section.title,
              requirement,
              sql,
              rows: [],
              error: error instanceof Error ? error.message : String(error),
            });
            plannedTasks.push("Snowflake: SQL probe failed");
          }
        }
      }
    }

    coverage.push({
      sectionId: section.section_id,
      sectionTitle: section.title,
      plannedTasks,
      unmetRequirements,
    });
  }

  for (const connection of connections) {
    if (!Array.isArray(connection.datasets)) {
      continue;
    }

    for (const dataset of connection.datasets) {
      if (dataset.retrievalMethod === "download" && dataset.url === null) {
        const matchedSection = scopeSections.find((section) =>
          Array.isArray(section.data_requirements)
            ? section.data_requirements.some((requirement) =>
                requirement.toLowerCase().includes(dataset.title.toLowerCase())
              )
            : false
        );

        userFileContexts.push({
          sectionId: matchedSection?.section_id ?? scopeSections.at(0)?.section_id ?? "general",
          sectionTitle: matchedSection?.title ?? scopeSections.at(0)?.title ?? "Synthèse",
          filename: dataset.title,
          description: dataset.description,
        });
      }
    }
  }

  const uniqueWebContexts = webContexts.reduce<WebResearchContext[]>((acc, context) => {
    const signature = `${context.sectionId}-${context.query.toLowerCase()}`;
    if (acc.some((item) => `${item.sectionId}-${item.query.toLowerCase()}` === signature)) {
      return acc;
    }
    if (acc.filter((item) => item.sectionId === context.sectionId).length >= 2) {
      return acc;
    }
    acc.push(context);
    return acc;
  }, []);

  const webResults = await Promise.all(
    uniqueWebContexts.map(async (context): Promise<WebSearchResult> => {
      const serpResults = await fetchSerpResults(context);

      if (serpResults.length === 0) {
        if (!serpApiKey) {
          return {
            sectionId: context.sectionId,
            query: context.query,
            summary: "Résultats web non récupérés : renseignez SERPAPI_KEY pour activer la recherche réelle.",
            snippets: [],
            sources: [],
            confidence: "low",
          };
        }

        const fallbackPrompt = [
          "Tu es un analyste de recherche. Propose une courte synthèse basée sur ton expertise métier en attendant les résultats web.",
          `Section: ${context.sectionTitle}`,
          context.sectionDescription ? `Description: ${context.sectionDescription}` : "",
          `Requête: ${context.query}`,
          "Réponds en français via JSON strict { \"summary\": string }.",
        ]
          .filter(Boolean)
          .join("\n\n");

        try {
          const { text } = await generateText({
            model: myProvider.languageModel("chat-model"),
            maxOutputTokens: 200,
            temperature: 0.5,
            prompt: fallbackPrompt,
          });
          const parsed = webResultSchema.parse(
            JSON.parse(stripCodeFences(text || "{}"))
          );
          return {
            sectionId: context.sectionId,
            query: context.query,
            summary: parsed.summary,
            snippets: parsed.snippets ?? [],
            sources: parsed.sources ?? [],
            confidence: parsed.confidence ?? "low",
          };
        } catch (_error) {
          return {
            sectionId: context.sectionId,
            query: context.query,
            summary: `Synthèse de ${context.sectionTitle} indisponible (échec de la recherche).`,
            snippets: [],
            sources: [],
            confidence: "low",
          };
        }
      }

      const summarised = await summariseSerpResults({ context, results: serpResults });
      const snippets = serpResults.map((result) => `${result.title} — ${result.snippet}`);
      const sources = serpResults.map((result) => result.link);

      return {
        sectionId: context.sectionId,
        query: context.query,
        summary: summarised.summary,
        snippets,
        sources,
        confidence: summarised.confidence,
      };
    })
  );

  const proprietaryResults = await Promise.all(
    proprietaryContexts.map(async (context): Promise<ProprietarySearchResult> => {
      const prompt = [
        "Tu agis comme analyste data engineering. Résume la valeur d'un jeu de données propriétaire pour répondre à un besoin.",
        `Section: ${context.sectionTitle}`,
        `Requirement: ${context.requirement}`,
        `Source: ${context.sourceName}`,
        `Jeu de données: ${context.datasetName} — ${context.datasetSummary}`,
        "Retourne un JSON strict { \"summary\": string, \"nextSteps\": string } en français.",
        context.accessStatus === "requires_access"
          ? "Précise que l'accès nécessite une levée de droits dans nextSteps."
          : "Indique comment exploiter immédiatement le dataset dans nextSteps.",
        "Pas d'autre texte que le JSON.",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const { text } = await generateText({
          model: myProvider.languageModel("chat-model"),
          maxOutputTokens: 400,
          temperature: 0.35,
          prompt,
        });
        const parsed = proprietaryResultSchema.parse(
          JSON.parse(stripCodeFences(text || "{}"))
        );
        return {
          sectionId: context.sectionId,
          sourceId: context.sourceId,
          dataset: context.datasetName,
          summary: parsed.summary,
          nextSteps:
            parsed.nextSteps ?? "Coordonner avec l'équipe data pour confirmer les modalités d'accès.",
          availability: context.accessStatus,
        };
      } catch (error) {
        return {
          sectionId: context.sectionId,
          sourceId: context.sourceId,
          dataset: context.datasetName,
          summary: `Évaluation préliminaire du dataset ${context.datasetName}.`,
          nextSteps:
            context.accessStatus === "requires_access"
              ? "Initier une demande d'accès auprès du propriétaire des données."
              : "Planifier une ingestion pilote et valider la qualité des champs clés.",
          availability: context.accessStatus,
        };
      }
    })
  );

  const userFileInsights = await Promise.all(
    userFileContexts.map(async (context): Promise<UserFileInsight> => {
      const prompt = [
        "Analyse le contenu d'un fichier utilisateur supposé (ex: Excel, PDF, PPT).",
        `Section ciblée: ${context.sectionTitle}`,
        `Nom du fichier: ${context.filename}`,
        `Description fournie: ${context.description}`,
        "Retourne un JSON strict { \"summary\": string, \"keyMetrics\": string[] } en français.",
        "Propose des indicateurs plausibles et mentionne les validations nécessaires.",
        "Pas de texte hors JSON.",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const { text } = await generateText({
          model: myProvider.languageModel("chat-model"),
          maxOutputTokens: 300,
          temperature: 0.3,
          prompt,
        });
        const parsed = userFileInsightSchema.parse(
          JSON.parse(stripCodeFences(text || "{}"))
        );
        return {
          sectionId: context.sectionId,
          filename: context.filename,
          summary: parsed.summary,
          keyMetrics: parsed.keyMetrics ?? [],
        };
      } catch (error) {
        return {
          sectionId: context.sectionId,
          filename: context.filename,
          summary: `Le fichier ${context.filename} nécessite une revue manuelle pour confirmer sa structure et sa fraîcheur.`,
          keyMetrics: [],
        };
      }
    })
  );

  const snowflakeSummary: SnowflakeSearchSummary | undefined =
    activeSnowflakeConnection || snowflakeStatus.status !== "disabled"
      ? {
          status: snowflakeStatus.status,
          message: snowflakeStatus.message,
          results: snowflakeResults,
        }
      : undefined;

  const plan: SearchPlanSummary = {
    tasks,
    coverage,
    snowflake: snowflakeSummary,
    web: webResults,
    proprietary: proprietaryResults,
    userFiles: userFileInsights,
  };

  console.log("\n\n\n\nData searcher agent: ", JSON.stringify(plan));

  return {
    searchResults: plan,
    executionHistory: [
      ...history,
      {
        agent: "data_searcher",
        timestamp: new Date(),
        status: "completed",
        output: `Prepared ${tasks.length} task${tasks.length === 1 ? "" : "s"} with ${webResults.length} web digest${
          webResults.length === 1 ? "" : "s"
        } and ${snowflakeResults.length} Snowflake probe${snowflakeResults.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
