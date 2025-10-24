import type { AgentNode } from "../graph-state/graph-state";
import type {
  AnalysisComponent,
  DeliverableCitationAnchor,
  DeliverableCitationEntry,
  DeliverableExport,
  DeliverableMode,
  PresentationSection,
  RankedSource,
  RenderedDeliverable,
  RenderedSection,
  RenderedVisual,
  ScopeSection,
  SnowflakeSearchResult,
} from "../types";

type PackagingContext = {
  sections: PresentationSection[];
  analysisComponents: AnalysisComponent[];
  scopeSections: ScopeSection[];
  recommendedSources: RankedSource[];
  supplementarySources: RankedSource[];
  snowflakeResults: SnowflakeSearchResult[];
  executiveSummary: string;
  appendices: string[];
  locale: string;
  timezone: string;
  defaultMode: DeliverableMode;
};

const resolveDefaultMode = (profile: unknown): DeliverableMode => {
  if (profile && typeof profile === "object" && "seniority" in profile) {
    const seniority = String((profile as Record<string, unknown>).seniority ?? "").toLowerCase();
    if (seniority.includes("partner") || seniority.includes("c")) {
      return "exec";
    }
  }
  return "exec";
};

const normalizeLocale = (profile: unknown): string => {
  if (profile && typeof profile === "object" && "locale" in profile) {
    const raw = (profile as Record<string, unknown>).locale;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw;
    }
  }
  return "fr-FR";
};

const normalizeTimezone = (profile: unknown): string => {
  if (profile && typeof profile === "object" && "timezone" in profile) {
    const raw = (profile as Record<string, unknown>).timezone;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw;
    }
  }
  return "Europe/Paris";
};

const createVisualFromAnalysis = (
  component: AnalysisComponent,
  fallbackId: string
): RenderedVisual => {
  const text = component.visualization.toLowerCase();
  const type: RenderedVisual["type"] = text.includes("table") ? "table" : "chart";
  return {
    id: component.sectionId || fallbackId,
    type,
    title: component.title,
    description: component.visualization,
    source: component.inputs.join(", ") || "Analytical model",
    cached: true,
  };
};

const buildSections = (context: PackagingContext): RenderedSection[] => {
  return context.sections.map((section, index) => {
    const scopeSection = context.scopeSections.at(index);
    const sectionId = scopeSection?.section_id ?? `section-${index + 1}`;
    const relatedComponents = context.analysisComponents.filter((component) => {
      if (component.sectionId) {
        return component.sectionId === sectionId;
      }
      return component.title.toLowerCase() === section.title.toLowerCase();
    });

    const visuals = relatedComponents.map((component, componentIndex) =>
      createVisualFromAnalysis(component, `${sectionId}-visual-${componentIndex + 1}`)
    );

    const dataHighlights = Array.isArray(section.supportingData)
      ? section.supportingData
      : [];

    return {
      id: sectionId,
      title: section.title,
      density: context.defaultMode,
      summary: Array.isArray(section.keyFindings) ? section.keyFindings : [],
      dataHighlights,
      visuals,
      narrative: section.nextSteps,
    };
  });
};

const buildCitations = (
  recommendedSources: RankedSource[],
  supplementarySources: RankedSource[],
  snowflakeResults: SnowflakeSearchResult[],
  sections: RenderedSection[]
): {
  anchors: DeliverableCitationAnchor[];
  bibliography: DeliverableCitationEntry[];
} => {
  const bibliography: DeliverableCitationEntry[] = [];
  let counter = 1;

  const registerSource = (
    source: RankedSource,
    note?: string
  ): DeliverableCitationEntry => {
    const entry: DeliverableCitationEntry = {
      id: `C${counter}`,
      title: source.name,
      url: source.url,
      publisher: note ?? source.description,
      access: source.access,
      trustLevel: source.trustLevel,
      retrievedAt: new Date().toISOString(),
    };
    counter += 1;
    bibliography.push(entry);
    return entry;
  };

  const uniqueSources = new Map<string, DeliverableCitationEntry>();

  for (const source of recommendedSources) {
    if (!uniqueSources.has(source.id)) {
      uniqueSources.set(source.id, registerSource(source));
    }
  }

  for (const source of supplementarySources) {
    if (!uniqueSources.has(source.id)) {
      uniqueSources.set(source.id, registerSource(source, `${source.description} (supplémentaire)`));
    }
  }

  snowflakeResults.forEach((result) => {
    const syntheticSource: RankedSource = {
      id: `snowflake-${result.sectionId}`,
      name: `Snowflake dataset – ${result.sectionTitle}`,
      url: "snowflake://secure-share",
      description: `SQL: ${result.sql.slice(0, 120)}${result.sql.length > 120 ? "…" : ""}`,
      trustLevel: "verified",
      access: "paid",
      matchScore: 1,
      matchedOn: ["function"],
    };
    if (!uniqueSources.has(syntheticSource.id)) {
      uniqueSources.set(syntheticSource.id, registerSource(syntheticSource, "Snowflake Marketplace"));
    }
  });

  const anchors: DeliverableCitationAnchor[] = sections.map((section, index) => {
    const bibliographyEntry = bibliography.at(index % Math.max(bibliography.length, 1));
    return {
      id: `anchor-${index + 1}`,
      sectionId: section.id,
      label: `[${index + 1}]`,
      target: bibliographyEntry?.id ?? "C1",
    };
  });

  return { anchors, bibliography };
};

const buildExports = (sections: RenderedSection[], appendices: string[]): DeliverableExport[] => {
  const includeBaseline = sections.map((section) => section.title);
  const appendixTitles = appendices.length > 0 ? appendices : ["Annexes"];
  return [
    {
      format: "pdf",
      filename: "rapport-executif.pdf",
      status: "queued",
      includes: [...includeBaseline, ...appendixTitles],
    },
    {
      format: "pptx",
      filename: "deck-synthese.pptx",
      status: "queued",
      includes: includeBaseline.slice(0, 5),
    },
    {
      format: "docx",
      filename: "rapport-detaille.docx",
      status: "queued",
      includes: [...includeBaseline, ...appendixTitles],
    },
    {
      format: "csv",
      filename: "extractions-donnees.csv",
      status: "queued",
      includes: sections.flatMap((section) => section.dataHighlights),
    },
  ];
};

const buildPackagingContext = (state: Parameters<AgentNode>[0]): PackagingContext => {
  const presentation = state.presentation as
    | { sections?: PresentationSection[]; executiveSummary?: string; appendices?: string[] }
    | undefined;
  const analysis = state.analysisResults as { components?: AnalysisComponent[] } | undefined;
  const scope = state.scope as { sections?: ScopeSection[] } | undefined;
  const dataSources = state.dataSources as
    | {
        data_source_manager?: {
          recommended_sources?: RankedSource[];
          supplementary_sources?: RankedSource[];
        };
      }
    | undefined;
  const searchPlan = state.searchResults as
    | { snowflake?: { results?: SnowflakeSearchResult[] } }
    | undefined;

  const sections = Array.isArray(presentation?.sections)
    ? (presentation.sections as PresentationSection[])
    : [];
  const analysisComponents = Array.isArray(analysis?.components)
    ? (analysis.components as AnalysisComponent[])
    : [];
  const scopeSections = Array.isArray(scope?.sections)
    ? (scope.sections as ScopeSection[])
    : [];
  const recommendedSources = Array.isArray(
    dataSources?.data_source_manager?.recommended_sources
  )
    ? (dataSources?.data_source_manager?.recommended_sources as RankedSource[])
    : [];
  const supplementarySources = Array.isArray(
    dataSources?.data_source_manager?.supplementary_sources
  )
    ? (dataSources?.data_source_manager?.supplementary_sources as RankedSource[])
    : [];

  const snowflakeResults = Array.isArray(searchPlan?.snowflake?.results)
    ? (searchPlan?.snowflake?.results as SnowflakeSearchResult[])
    : [];

  const executiveSummary = typeof presentation?.executiveSummary === "string"
    ? presentation.executiveSummary
    : "Synthèse exécutive à compléter une fois les analyses finalisées.";

  const appendices = Array.isArray(presentation?.appendices)
    ? presentation.appendices
    : [];

  const locale = normalizeLocale(state.userProfile);
  const timezone = normalizeTimezone(state.userProfile);
  const defaultMode = resolveDefaultMode(state.userProfile);

  return {
    sections,
    analysisComponents,
    scopeSections,
    recommendedSources,
    supplementarySources,
    snowflakeResults,
    executiveSummary,
    appendices,
    locale,
    timezone,
    defaultMode,
  };
};

export const renderPackagerAgent: AgentNode = async (state) => {
  const history = Array.isArray(state.executionHistory)
    ? state.executionHistory
    : [];

  const context = buildPackagingContext(state);
  const renderedSections = buildSections(context);
  const citations = buildCitations(
    context.recommendedSources,
    context.supplementarySources,
    context.snowflakeResults,
    renderedSections
  );
  const exports = buildExports(renderedSections, context.appendices);

  const versionHistory = history
    .filter((entry) => entry.agent !== "render_packager")
    .map((entry, index) => ({
      version: index + 1,
      summary: typeof entry.output === "string" ? entry.output : entry.agent,
      timestamp:
        entry.timestamp instanceof Date
          ? entry.timestamp.toISOString()
          : new Date().toISOString(),
    }));

  const deliverable: RenderedDeliverable = {
    template: "consulting-report/v1",
    version: {
      current: versionHistory.length + 1,
      history: versionHistory,
    },
    pagination: {
      totalPages: Math.max(1, renderedSections.length + 1),
      strategy: "auto",
    },
    mode: context.defaultMode,
    controls: {
      availableModes: ["exec", "detailed"],
      defaultMode: context.defaultMode,
    },
    locale: context.locale,
    numberFormat: context.locale === "fr-FR" ? "1 234,56" : "1,234.56",
    dateFormat: context.locale.startsWith("fr") ? "dd/MM/yyyy" : "MM/dd/yyyy",
    executiveSummary: {
      headline: "Synthèse exécutive",
      body: [context.executiveSummary],
      highlights: renderedSections.flatMap((section) => section.summary).slice(0, 4),
    },
    sections: renderedSections,
    appendices: context.appendices,
    exports,
    citations,
    accessibility: {
      status: "pending",
      checklist: [
        "Vérifier les titres de graphiques et légendes pour les lecteurs d'écran.",
        "Confirmer le contraste couleur/texte pour chaque visuel.",
        "Associer chaque tableau à une alternative textuelle.",
      ],
    },
    assets: {
      visualCache: renderedSections.flatMap((section) => section.visuals),
    },
    internationalization: {
      timezone: context.timezone,
    },
  };

  console.log("\n\n\n Rendered deliverable")
  console.log(JSON.stringify(deliverable, null, 2))
  console.log('\n\n\n')

  return {
    renderedDeliverable: deliverable,
    executionHistory: [
      ...history,
      {
        agent: "render_packager",
        timestamp: new Date(),
        status: "completed",
        output: `Assemblage du livrable (${renderedSections.length} section${renderedSections.length === 1 ? "" : "s"}) prêt pour export.`,
      },
    ],
  };
};
