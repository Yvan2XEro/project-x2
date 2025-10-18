import { usedModel } from "@/lib/constants";
import { z } from "zod";
import { DATA_SOURCES_REPOSITORY } from "../data-resources/data-source-for-test";
import { AgentNode, AgentStateType } from "../graph-state/graph-state";

// --- TYPES ---
interface DetectedCompany {
  name: string;
  official_url: string | null;
  confidence: number;
}

// --- AGENT PRINCIPAL ---
export const dataSourceManagerAgent: AgentNode = async (state: AgentStateType) => {
  const { userInput, triageResult, userProfile } = state;

  if (!triageResult) {
    return errorState(state, "Missing triage result");
  }

  try {
    const companies = await detectCompanies(userInput);

    // filter ressorces
    let sources = DATA_SOURCES_REPOSITORY.filter(
      (src) =>
        src.sector.includes(triageResult.sector) &&
        src.function.includes(triageResult.function)
    );

    // filter trusted sources
    if (userProfile?.trusted_sources_only) {
      sources = sources.filter((src) => src.trust_level === "high");
    }

    // add company urls
    const companyUrls = companies
      .filter((c) => c.official_url && c.confidence > 0.7)
      .map((c) => c.official_url as string);

    const preferredSources = [...new Set([...sources.map((s) => s.url), ...companyUrls])];

    const result = {
      preferred_sources: preferredSources,
      detected_companies: companies,
      trusted_sources_only: userProfile?.trusted_sources_only ?? false,
    };

    return successState(state, "data_source_manager", result);
  } catch (err: any) {
    return errorState(state, err.message);
  }
};

async function detectCompanies(text: string): Promise<DetectedCompany[]> {
  try {
    const model = usedModel;

    const schema = z.object({
      companies: z.array(
        z.object({
          name: z.string(),
          official_url: z.string().nullable(),
          confidence: z.number(),
        })
      ),
    });

    const structured = model.withStructuredOutput(schema);
    const result = await structured.invoke(`
      Extract company names and their official URLs from this text:
      "${text}"
      Include only companies with confidence > 0.6.
    `);

    return enhanceCompanyUrls(result.companies);
  } catch {
    return [];
  }
}

function enhanceCompanyUrls(companies: DetectedCompany[]): DetectedCompany[] {
  const known: Record<string, string> = {
    tesla: "https://www.tesla.com",
    apple: "https://www.apple.com",
    google: "https://www.google.com",
    amazon: "https://www.amazon.com",
    microsoft: "https://www.microsoft.com",
  };

  return companies.map((c) => {
    const lower = c.name.toLowerCase();
    if (!c.official_url && known[lower]) {
      return { ...c, official_url: known[lower], confidence: Math.max(c.confidence, 0.9) };
    }
    return c;
  });
}

function successState(state: AgentStateType, agent: string, output: any) {
  return {
    ...state,
    dataSources: output,
    currentAgent: agent,
    executionHistory: [
      ...state.executionHistory,
      { agent, timestamp: new Date(), status: "completed", output },
    ],
  };
}

function errorState(state: AgentStateType, message: string) {
  return {
    ...state,
    executionHistory: [
      ...state.executionHistory,
      { agent: "data_source_manager", timestamp: new Date(), status: "error", output: message },
    ],
  };
}
