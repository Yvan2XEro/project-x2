import { normalizeUserInput } from "@/utils/normalize-user-input";
import type { AgentNode, AgentStateType } from "../graph-state/graph-state";
import type { UserInput } from "./tiager-prompt-enhancer";

type ConnectionStatus = "ready" | "requires_credentials" | "not_applicable";

type DatasetDescriptor = {
  title: string;
  description: string;
  retrievalMethod: "api" | "download" | "report";
  url: string | null;
};

type DataConnection = {
  sourceId: string;
  name: string;
  access: "free" | "paid";
  trustLevel: "verified" | "trusted";
  status: ConnectionStatus;
  notes: string;
  datasets: DatasetDescriptor[];
};

type DataConnectionSummary = {
  context: {
    sector: string;
    function: string;
    geography: string;
    timeframe?: string;
    keywords: string[];
  };
  connections: DataConnection[];
};

function buildKeywords(state: AgentStateType): string[] {
  const keywords = new Set<string>();
  const enhanced = state.enhancedPrompt;

  if (enhanced?.analysis_type) {
    keywords.add(enhanced.analysis_type.toLowerCase());
  }

  if (Array.isArray(enhanced?.specific_factors_mentioned)) {
    for (const factor of enhanced.specific_factors_mentioned) {
      const trimmed = factor.trim().toLowerCase();
      if (trimmed) {
        keywords.add(trimmed);
      }
    }
  }

  if (Array.isArray(enhanced?.framework_components)) {
    for (const component of enhanced.framework_components) {
      const name = component.component?.toLowerCase();
      if (name) {
        keywords.add(name);
      }
    }
  }

  if (enhanced?.geographic_reference) {
    keywords.add(enhanced.geographic_reference.toLowerCase());
  }

  const userInput = normalizeUserInput(state.userInput as UserInput);
  for (const token of userInput.split(/[,.;\n]/)) {
    const trimmed = token.trim();
    if (trimmed.length > 4 && trimmed.split(" ").length <= 3) {
      keywords.add(trimmed.toLowerCase());
    }
  }

  return Array.from(keywords).slice(0, 12);
}

function describeDatasets(
  source: {
    name: string;
    access: "free" | "paid";
    trustLevel: "verified" | "trusted";
    url: string;
  },
  context: { keywords: string[]; geography: string; timeframe?: string }
): DatasetDescriptor[] {
  const topics = context.keywords.slice(0, 3);
  const timeframe = context.timeframe ? ` (${context.timeframe})` : "";

  if (topics.length === 0) {
    topics.push(context.geography.toLowerCase(), "baseline trend");
  }

  return topics.map((topic) => ({
    title: `${source.name} – ${topic.replace(/\b\w/g, (c) => c.toUpperCase())}${timeframe}`,
    description: `Extract ${topic} indicators filtered for ${context.geography}. Align output with SMART objectives defined previously.`,
    retrievalMethod: source.access === "free" ? "api" : "report",
    url: source.url,
  }));
}

export const dataConnectorAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];
  const manager = state.dataSources?.data_source_manager;

  if (!manager) {
    return {
      executionHistory: [
        ...history,
        {
          agent: "data_connector",
          timestamp: new Date(),
          status: "error",
          output: "No data-source recommendations available for connection stage.",
        },
      ],
    };
  }

  const context = {
    sector: manager.sector ?? "General",
    function: manager.function ?? "General",
    geography: manager.geography ?? "Global",
    timeframe: state.enhancedPrompt?.timeframe,
    keywords: buildKeywords(state),
  };

  const sources = [
    ...(Array.isArray(manager.recommended_sources)
      ? manager.recommended_sources
      : []),
    ...(Array.isArray(manager.supplementary_sources)
      ? manager.supplementary_sources
      : []),
  ].slice(0, 6);

  const connections: DataConnection[] = sources.map((source) => {
    const status: ConnectionStatus =
      source.access === "free"
        ? "ready"
        : "requires_credentials";

    const notes =
      status === "ready"
        ? "API key or open download available – build automated pull in data pipelines."
        : "Requires enterprise credentials before extraction can begin.";

    return {
      sourceId: source.id,
      name: source.name,
      access: source.access,
      trustLevel: source.trustLevel,
      status,
      notes,
      datasets: describeDatasets(source, context),
    };
  });

  const summary: DataConnectionSummary = {
    context,
    connections,
  };

  return {
    dataConnections: summary,
    executionHistory: [
      ...history,
      {
        agent: "data_connector",
        timestamp: new Date(),
        status: "completed",
        output: `Prepared ${connections.length} data connection${connections.length === 1 ? "" : "s"}.`,
      },
    ],
  };
};
