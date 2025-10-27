import { normalizeUserInput } from "@/utils/normalize-user-input";
import type { AgentNode, AgentStateType } from "../graph-state/graph-state";
import type { UserInput } from "./tiager-prompt-enhancer";

type TrustLevel = "verified" | "trusted";
type Access = "free" | "paid";

type RepositorySource = {
  id: string;
  name: string;
  url: string;
  description: string;
  sectors: string[];
  functions: string[];
  geographies?: string[];
  trustLevel: TrustLevel;
  access: Access;
};

type RankedSource = {
  id: string;
  name: string;
  url: string;
  description: string;
  trustLevel: TrustLevel;
  access: Access;
  matchScore: number;
  matchedOn: Array<"sector" | "function" | "geography">;
};

type ExcludedSource = {
  id: string;
  name: string;
  trustLevel: TrustLevel;
  reason: string;
};

type CompanyMatch = {
  name: string;
  officialUrl: string | null;
  confidence: number;
};

type AgentPayload = {
  data_source_manager: {
    sector: string;
    function: string;
    geography: string;
    trusted_sources_only: boolean;
    recommended_sources: RankedSource[];
    supplementary_sources: RankedSource[];
    excluded_sources: ExcludedSource[];
    detected_companies: CompanyMatch[];
    notes: string[];
  };
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

const COMPANY_REGEX =
  /\b([A-Z][A-Za-z0-9&]*(?:\s+(?:[A-Z][A-Za-z0-9&]*|&|and|Group|Holdings|Corporation|Corp\.?|Inc\.?|Ltd\.?|LLC|PLC|Partners|Capital|Technologies|Systems))*)\b/g;

export const dataSourceManagerAgent: AgentNode = async (state) => {
  const history = state.executionHistory ?? [];

  try {
    const enhanced = state.enhancedPrompt;
    const sector = enhanced?.triageResult?.sector ?? "General";
    const businessFunction = enhanced?.triageResult?.function ?? "General";
    const geography = enhanced?.geographic_reference ?? "Global";
    const userInput = normalizeUserInput(state.userInput as UserInput);
    const trustedOnly = shouldLimitToVerified(state.userProfile, userInput);

    const selection = rankSources({ sector, businessFunction, geography, trustedOnly });
    const detectedCompanies = await resolveCompanies({ state, userInput });

    const payload: AgentPayload = {
      data_source_manager: {
        sector,
        function: businessFunction,
        geography,
        trusted_sources_only: trustedOnly,
        recommended_sources: selection.recommended,
        supplementary_sources: selection.supplementary,
        excluded_sources: selection.excluded,
        detected_companies: detectedCompanies,
        notes: selection.notes,
      },
    };
    const data = {
      dataSources: payload,
      currentAgent: "completed",
      executionHistory: [
        ...history,
        {
          agent: "data_source_manager",
          timestamp: new Date(),
          status: "completed",
          output: payload,
        },
      ],
    }
    console.log("\n\n\n\nData source manager agent: ", JSON.stringify(data));

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    return {
      executionHistory: [
        ...history,
        {
          agent: "data_source_manager",
          timestamp: new Date(),
          status: "error",
          output: message,
        },
      ],
    };
  }
};

type RankingInput = {
  sector: string;
  businessFunction: string;
  geography: string;
  trustedOnly: boolean;
};

type RankingOutput = {
  recommended: RankedSource[];
  supplementary: RankedSource[];
  excluded: ExcludedSource[];
  notes: string[];
};

function rankSources(input: RankingInput): RankingOutput {
  const sector = input.sector.toLowerCase();
  const func = input.businessFunction.toLowerCase();
  const geo = input.geography.toLowerCase();

  const ranked: RankedSource[] = [];
  const excluded: ExcludedSource[] = [];

  for (const source of DATA_SOURCES) {
    if (input.trustedOnly && source.trustLevel !== "verified") {
      excluded.push({
        id: source.id,
        name: source.name,
        trustLevel: source.trustLevel,
        reason: "User requested verified sources only.",
      });
      continue;
    }

    const matchedOn: RankedSource["matchedOn"] = [];

    if (matchesTag(source.sectors, sector)) {
      matchedOn.push("sector");
    }
    if (matchesTag(source.functions, func)) {
      matchedOn.push("function");
    }
    if (source.geographies && matchesTag(source.geographies, geo)) {
      matchedOn.push("geography");
    }

    const score = matchedOn.length === 0 ? 1 : matchedOn.length * 2 + (source.trustLevel === "verified" ? 1 : 0);

    ranked.push({
      id: source.id,
      name: source.name,
      url: source.url,
      description: source.description,
      trustLevel: source.trustLevel,
      access: source.access,
      matchScore: score,
      matchedOn,
    });
  }

  if (ranked.length === 0) {
    return { recommended: [], supplementary: [], excluded, notes: ["No data sources available after filtering."] };
  }

  const sorted = ranked.sort((a, b) => b.matchScore - a.matchScore);
  const recommended = sorted.slice(0, 3);
  const supplementary = sorted.slice(3);

  const notes = buildNotes({ sector: input.sector, businessFunction: input.businessFunction, geography: input.geography, trustedOnly: input.trustedOnly, topSource: recommended[0] });

  return { recommended, supplementary, excluded, notes };
}

type NotesInput = {
  sector: string;
  businessFunction: string;
  geography: string;
  trustedOnly: boolean;
  topSource: RankedSource | undefined;
};

function buildNotes(input: NotesInput): string[] {
  const notes = [
    `Sector focus: ${input.sector}`,
    `Primary function: ${input.businessFunction}`,
    `Geographic filter: ${input.geography}`,
  ];

  notes.push(
    input.trustedOnly
      ? "Selection restricted to verified datasets per user preference."
      : "Mix of verified institutional data and reputable commercial intelligence."
  );

  if (input.topSource) {
    notes.push(`Top match: ${input.topSource.name} (matched on ${input.topSource.matchedOn.join(", ") || "broad relevance"}).`);
  }

  return notes;
}

function matchesTag(tags: string[], value: string): boolean {
  if (!value) {
    return false;
  }

  for (const tag of tags) {
    if (value.includes(tag)) {
      return true;
    }
  }

  return tags.includes("all");
}

function shouldLimitToVerified(profile: AgentStateType["userProfile"], userInput: string): boolean {
  const text = userInput.toLowerCase();

  if (text.includes("verified sources only") || text.includes("trusted sources only") || text.includes("official sources")) {
    return true;
  }

  if (!profile || typeof profile !== "object") {
    return false;
  }

  if ((profile as { trusted_sources_only?: boolean }).trusted_sources_only) {
    return true;
  }

  const interests = (profile as { interests?: string[] }).interests;
  if (Array.isArray(interests)) {
    for (const interest of interests) {
      if (interest.toLowerCase().includes("trusted")) {
        return true;
      }
    }
  }

  return false;
}

type ResolveCompaniesInput = {
  state: AgentStateType;
  userInput: string;
};

async function resolveCompanies({ state, userInput }: ResolveCompaniesInput): Promise<CompanyMatch[]> {
  const candidates = new Set<string>();

  const factors = state.enhancedPrompt?.specific_factors_mentioned ?? [];
  for (const factor of factors) {
    const candidate = sanitiseCandidate(factor);
    if (isCompanyCandidate(candidate)) {
      candidates.add(candidate);
    }
  }

  let regexMatch: RegExpExecArray | null = null;
  while ((regexMatch = COMPANY_REGEX.exec(userInput)) !== null) {
    const candidate = sanitiseCandidate(regexMatch[1]);
    if (isCompanyCandidate(candidate)) {
      candidates.add(candidate);
    }
    if (candidates.size >= 5) {
      break;
    }
  }

  const limited = Array.from(candidates).slice(0, 5);
  const results: CompanyMatch[] = [];

  for (const name of limited) {
    const officialUrl = await fetchOfficialUrl(name);
    results.push({ name, officialUrl, confidence: officialUrl ? 0.8 : 0.4 });
  }

  return results;
}

function sanitiseCandidate(raw: string): string {
  return raw.replace(/[.,]/g, "").trim();
}

function isCompanyCandidate(candidate: string): boolean {
  if (!candidate || candidate.length < 2) {
    return false;
  }

  return /[A-Z]/.test(candidate[0]);
}

async function fetchOfficialUrl(name: string): Promise<string | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    engine: "google",
    q: `${name} official website`,
    api_key: apiKey,
    num: "1",
  });

  const response = await fetch(`https://serpapi.com/search?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { organic_results?: Array<{ link?: string }> };
  const first = data.organic_results && data.organic_results[0]?.link;

  return first ?? null;
}
