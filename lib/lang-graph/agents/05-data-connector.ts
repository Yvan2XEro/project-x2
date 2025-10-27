import { fetchSnowflakeTables, getSnowflakeStatus, ensureSnowflakeConnection } from "@/lib/services/snowflake";
import { normalizeUserInput } from "@/utils/normalize-user-input";
import type { AgentNode, AgentStateType } from "../graph-state/graph-state";
import type { UserInput } from "./tiager-prompt-enhancer";

type AccessType = "free" | "paid";
type TrustLevel = "verified" | "trusted";
type ConnectionStatus = "ready" | "requires_credentials" | "not_applicable";

type RepositorySource = {
  id: string;
  name: string;
  url: string;
  description: string;
  sectors: string[];
  functions: string[];
  geographies?: string[];
  trustLevel: TrustLevel;
  access: AccessType;
};

type DatasetDescriptor = {
  title: string;
  description: string;
  retrievalMethod: "api" | "download" | "report" | "data_share";
  url: string | null;
};

type DataConnection = {
  sourceId: string;
  name: string;
  access: AccessType;
  trustLevel: TrustLevel;
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

const DATA_SOURCES: RepositorySource[] = [
  {
    id: "world-bank",
    name: "World Bank Data",
    url: "https://data.worldbank.org",
    description: "Macroeconomic indicators across 200+ countries.",
    sectors: ["all", "financial services", "infrastructure"],
    functions: ["market analysis", "economic outlook", "risk assessment"],
    geographies: ["global"],
    trustLevel: "verified",
    access: "free",
  },
   {
    id: "knovva",
    name: "Knovva Real Estate Data",
    url: "https://www.knovva.com", 
    description: "Proprietary database focusing on commercial and residential real estate prices and yields in emerging markets.",
    sectors: ["real estate", "financial services"],
    functions: ["market analysis", "investment research", "benchmarking"],
    geographies: ["global", "africa", "latin america"],
    trustLevel: "trusted",
    access: "paid",
  },
  {
    id: "snowflake-marketplace",
    name: "Snowflake Marketplace",
    url: "https://www.snowflake.com/en/marketplace/",
    description: "Potential source for real estate and economic datasets via secure data sharing.",
    sectors: ["all", "real estate", "financial services"],
    functions: ["market analysis", "benchmarking", "risk assessment"],
    geographies: ["global"],
    trustLevel: "trusted",
    access: "paid",
  },
  {
    id: "oecd",
    name: "OECD Statistics",
    url: "https://stats.oecd.org",
    description: "Socio-economic datasets for OECD members.",
    sectors: ["all", "public sector", "financial services"],
    functions: ["policy analysis", "market analysis"],
    geographies: ["global", "oecd"],
    trustLevel: "verified",
    access: "free",
  },
  {
    id: "imf",
    name: "IMF Data",
    url: "https://data.imf.org",
    description: "International fiscal and monetary statistics.",
    sectors: ["all", "financial services"],
    functions: ["economic outlook", "risk assessment"],
    trustLevel: "verified",
    access: "free",
  },
  {
    id: "cap-iq",
    name: "S&P Capital IQ",
    url: "https://www.capitaliq.com",
    description: "Company fundamentals and market intelligence.",
    sectors: ["financial services", "technology", "industrials"],
    functions: ["investment research", "competitive analysis"],
    trustLevel: "trusted",
    access: "paid",
  },
  {
    id: "pitchbook",
    name: "PitchBook",
    url: "https://pitchbook.com",
    description: "Private market, VC, and PE intelligence.",
    sectors: ["technology", "healthcare", "financial services"],
    functions: ["investment research", "market analysis"],
    trustLevel: "trusted",
    access: "paid",
  },
  {
    id: "statista",
    name: "Statista",
    url: "https://www.statista.com",
    description: "Cross-industry statistics and market sizing.",
    sectors: ["all", "consumer", "technology"],
    functions: ["market analysis", "benchmarking", "strategy"],
    geographies: ["global"],
    trustLevel: "trusted",
    access: "paid",
  },
  {
    id: "snowflake-marketplace",
    name: "Snowflake Marketplace",
    url: "https://www.snowflake.com/en/marketplace/",
    description:
      "Share-ready third-party datasets delivered via Snowflake secure data sharing.",
    sectors: ["financial services", "technology", "consumer", "healthcare", "energy"],
    functions: ["market analysis", "benchmarking", "risk assessment", "forecasting"],
    geographies: ["global"],
    trustLevel: "trusted",
    access: "paid",
  },
  {
    id: "who",
    name: "WHO Global Health Observatory",
    url: "https://www.who.int/data/gho",
    description: "Health outcomes and epidemiology datasets.",
    sectors: ["healthcare", "pharmaceuticals"],
    functions: ["market analysis", "risk assessment", "policy analysis"],
    geographies: ["global"],
    trustLevel: "verified",
    access: "free",
  },
  {
    id: "iea",
    name: "International Energy Agency",
    url: "https://www.iea.org/data-and-statistics",
    description: "Energy production, demand, and transition metrics.",
    sectors: ["energy", "utilities", "industrial"],
    functions: ["market analysis", "sustainability", "risk assessment"],
    trustLevel: "verified",
    access: "paid",
  },
  {
    id: "edgar",
    name: "SEC EDGAR Filings",
    url: "https://www.sec.gov/edgar.shtml",
    description: "Official filings for U.S.-listed companies.",
    sectors: ["all"],
    functions: ["regulatory", "due diligence", "investment research"],
    geographies: ["united states"],
    trustLevel: "verified",
    access: "free",
  },
];

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

function describeDatasets(source: RepositorySource, context: {
  keywords: string[];
  geography: string;
  timeframe?: string;
}): DatasetDescriptor[] {
  const topics = context.keywords.slice(0, 3);
  const timeframe = context.timeframe ? ` (${context.timeframe})` : "";

  if (topics.length === 0) {
    topics.push(context.geography.toLowerCase(), "baseline trend");
  }

  return topics.map((topic) => {
    const formattedTopic = topic.replace(/\b\w/g, (c) => c.toUpperCase());

    if (source.id === "snowflake-marketplace") {
      return {
        title: `${source.name} – ${formattedTopic}${timeframe}`,
        description: `Provision ${formattedTopic.toLowerCase()} indicators for ${context.geography} via Snowflake data share and align ingestion with SMART metrics.`,
        retrievalMethod: "data_share",
        url: source.url,
      };
    }

    return {
      title: `${source.name} – ${formattedTopic}${timeframe}`,
      description: `Extract ${formattedTopic.toLowerCase()} indicators filtered for ${context.geography}. Align output with SMART objectives defined previously.`,
      retrievalMethod: source.access === "free" ? "api" : "report",
      url: source.url,
    };
  });
}

function buildConnectionNotes(source: RepositorySource, status: ConnectionStatus): string {
  if (source.id === "snowflake-marketplace") {
    return "Provision through Snowflake secure data share – coordinate account entitlements and warehouse configuration.";
  }

  if (status === "ready") {
    return "API key or open download available – build automated pull in data pipelines.";
  }

  if (status === "requires_credentials") {
    return "Requires enterprise credentials before extraction can begin.";
  }

  return "Review source prerequisites before proceeding.";
}

function mapSnowflakeTablesToDatasets(tables: Array<{ schema: string; name: string; comment: string }>): DatasetDescriptor[] {
  return tables.map((table) => ({
    title: `Snowflake Secure Share – ${table.schema}.${table.name}`,
    description:
      table.comment && table.comment.length > 0
        ? table.comment
        : "Dataset available via Snowflake Marketplace secure share.",
    retrievalMethod: "data_share",
    url: "https://www.snowflake.com/en/marketplace/",
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

  const selectedSources = manager.recommended_sources ?? [];
  const supplementarySources = manager.supplementary_sources ?? [];

  const combined = [...selectedSources, ...supplementarySources]
    .slice(0, 6)
    .map((source: any) => source.id ?? source.name);

  const repositoryMap = new Map(DATA_SOURCES.map((source) => [source.id, source]));

  const connections: DataConnection[] = combined
    .map((sourceId) => repositoryMap.get(sourceId))
    .filter((source): source is RepositorySource => Boolean(source))
    .map((source) => {
      const status: ConnectionStatus =
        source.access === "free" ? "ready" : "requires_credentials";

      return {
        sourceId: source.id,
        name: source.name,
        access: source.access,
        trustLevel: source.trustLevel,
        status,
        notes: buildConnectionNotes(source, status),
        datasets: describeDatasets(source, context),
      };
    });

  await ensureSnowflakeConnection();
  const snowflakeTables = await fetchSnowflakeTables(context.keywords, 5);
  const snowflakeStatus = getSnowflakeStatus();

  const ensureSnowflakeConnectionEntry = () => {
    const existing = connections.find((connection) => connection.sourceId === "snowflake-marketplace");

    if (existing) {
      return existing;
    }

    const repository = repositoryMap.get("snowflake-marketplace");

    if (!repository) {
      return null;
    }

    const entry: DataConnection = {
      sourceId: repository.id,
      name: repository.name,
      access: repository.access,
      trustLevel: repository.trustLevel,
      status: "requires_credentials",
      notes: buildConnectionNotes(repository, "requires_credentials"),
      datasets: describeDatasets(repository, context),
    };

    connections.push(entry);
    return entry;
  };

  const snowflakeConnectionEntry = ensureSnowflakeConnectionEntry();

  if (snowflakeConnectionEntry) {
    if (snowflakeTables.length > 0) {
      snowflakeConnectionEntry.status = "ready";
      snowflakeConnectionEntry.datasets = mapSnowflakeTablesToDatasets(snowflakeTables);
      snowflakeConnectionEntry.notes =
        "Snowflake connection established – datasets available via secure data share.";
    } else if (snowflakeStatus.status === "error") {
      snowflakeConnectionEntry.notes = `Snowflake connection error: ${snowflakeStatus.message ?? "Unknown issue"}.`;
    } else if (snowflakeStatus.status === "disabled") {
      snowflakeConnectionEntry.notes =
        "Snowflake environment variables not configured. Provide credentials to activate secure shares.";
    }
  }

  const summary: DataConnectionSummary = {
    context,
    connections,
  };

  console.log("\n\n\n\nData connector agent: ", JSON.stringify(summary));

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
