import { myProvider } from "@/lib/ai/providers";
import {
  ensureSnowflakeConnection,
  executeSnowflakeQuery,
  getSnowflakeStatus,
} from "@/lib/services/snowflake";
import { normalizeUserInput } from "@/utils/normalize-user-input";
import { generateText } from "ai";
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

type SnowflakeSearchResult = {
  sectionId: string;
  sectionTitle: string;
  requirement: string;
  sql: string;
  rows: Array<Record<string, unknown>>;
  error?: string;
};

type SnowflakeSearchSummary = {
  status: ReturnType<typeof getSnowflakeStatus>["status"];
  message?: string;
  results: SnowflakeSearchResult[];
};

const MAX_SNOWFLAKE_QUERIES = 3;

async function generateSnowflakeSql({
  requirement,
  sectionTitle,
  geography,
  keywords,
}: {
  requirement: string;
  sectionTitle: string;
  geography: string;
  keywords: string[];
}): Promise<string | null> {
  const keywordList = keywords.slice(0, 5).join(", ");

  const prompt = [
    "You are a Snowflake SQL assistant. Return only a valid Snowflake SQL query.",
    `Requirement: ${requirement}`,
    `Section: ${sectionTitle}`,
    `Geography or filter: ${geography}`,
    keywordList ? `Relevant keywords: ${keywordList}` : "",
    "Return only the SQL statement without commentary or markdown fences.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model: myProvider.languageModel("chat-model"),
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

      if (activeSnowflakeConnection && executedSnowflakeQueries < MAX_SNOWFLAKE_QUERIES) {
        const sql = await generateSnowflakeSql({
          requirement,
          sectionTitle: section.title,
          geography,
          keywords,
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

  const plan: SearchPlan & { snowflake?: SnowflakeSearchSummary } = {
    tasks,
    coverage,
  };

  if (activeSnowflakeConnection || snowflakeStatus.status !== "disabled") {
    plan.snowflake = {
      status: snowflakeStatus.status,
      message: snowflakeStatus.message,
      results: snowflakeResults,
    };
  }

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
