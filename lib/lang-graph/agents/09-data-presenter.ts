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
    return "Aucun résultat Snowflake disponible.";
  }
  return results
    .slice(0, 2)
    .map((result) => {
      const sample = (result.rows ?? []).slice(0, 2);
      return `Section ${result.sectionTitle}: ${result.sql.slice(0, 140)}${
        result.sql.length > 140 ? "…" : ""
      }\nÉchantillon: ${JSON.stringify(sample, null, 2).slice(0, 400)}`;
    })
    .join("\n\n");
}

function formatWebForPrompt(results: WebSearchResult[]): string {
  if (!results.length) {
    return "Aucun résumé web n'a été produit.";
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
    return "Aucun jeu de données propriétaire décrit.";
  }
  return results
    .slice(0, 3)
    .map(
      (result) =>
        `${result.dataset} (${result.availability}) – ${result.summary}. Étapes: ${result.nextSteps}`
    )
    .join("\n");
}

function formatUserFilesForPrompt(results: UserFileInsight[]): string {
  if (!results.length) {
    return "Aucun fichier utilisateur signalé.";
  }
  return results
    .slice(0, 3)
    .map(
      (result) =>
        `${result.filename}: ${result.summary}${
          result.keyMetrics.length ? ` (indicateurs: ${result.keyMetrics.join(", ")})` : ""
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
    headline: "Synthèse exécutive provisoire",
    body: ["Impossible de générer une synthèse exécutive détaillée sans résultats d'analyse concrets."],
    highlights: ["Aucun point clé identifié."],
  };

  if (analysisComponents.length > 0 || snowflakeResults.length > 0) {
    try {
      const summaryPrompt = `
        Question utilisateur: "${state.userInput}"

        Synthèse des analyses:
        ${JSON.stringify(
          analysisComponents.map((component) => ({
            titre: component.title,
            resume: component.analysisSummary,
            constats: component.preliminaryFindings,
            visualisation: component.visualization,
          })),
          null,
          2
        )}

        Résultats Snowflake:
        ${formatSnowflakeForPrompt(snowflakeResults)}

        Insights web:
        ${formatWebForPrompt(webResults)}

        Jeux de données propriétaires:
        ${formatProprietaryForPrompt(proprietaryResults)}

        Fichiers utilisateur:
        ${formatUserFilesForPrompt(userFiles)}

        Produit un résumé exécutif, explicite et percutant (titre, 1-2 paragraphes, 3-5 bullet points) pour un rapport de conseil et a titre informatif. dans la meme langue que la question de l'utilisateur et base-toi uniquement sur les elements fournis; seulement en absence de ceux-ci tu peux produit une repose basée sur tes propres connaissances en la matiere.
      `;

      const structuredSummaryModel = chatModel.withStructuredOutput(ExecutiveSummarySchema);
      generatedExecutiveSummary = await structuredSummaryModel.invoke(summaryPrompt);
    } catch (_error) {
      generatedExecutiveSummary = {
        headline: "Synthèse exécutive à compléter",
        body: [
          "Les analyses doivent être revues manuellement pour formuler une conclusion sur l'opportunité d'investissement.",
        ],
        highlights: [
          "Conclusions en attente de validation des données propriétaires.",
        ],
      };
    }
  }


  const sections: PresentationSection[] = await Promise.all(
    analysisComponents.map(async (component) => {
      let keyFindings: string[] = ["Impossible de générer des points clés."];
      let narrative: string = "Impossible de générer un narratif.";

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
          Question utilisateur: "${state.userInput}"
          Section: "${component.title}" — ${component.description}
          Résumé d'analyse: ${component.analysisSummary}
          Constat chiffré: ${component.preliminaryFindings}
          Web: ${formatWebForPrompt(sectionWeb)}
          Propriétaire: ${formatProprietaryForPrompt(sectionProprietary)}
          Fichiers utilisateur: ${formatUserFilesForPrompt(sectionFiles)}
          Snowflake: ${formatSnowflakeForPrompt(sectionSnowflake)}

          Fournis 2 à 3 messages clés puis un paragraphe narratif intégrant les preuves. Réponds dans la meme langue que la question de l'utilisateur.
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
    executiveSummary: `${generatedExecutiveSummary.headline}\n\n${generatedExecutiveSummary.body.join("\n\n")}\n\nPoints clés :\n${generatedExecutiveSummary.highlights
      .map((highlight) => `- ${highlight}`)
      .join("\n")}`.trim(),
    sections,
    appendices: [
      "Liste des sources et notes d'accès.",
      "Journal de méthodologie et hypothèses.",
      "Actions de suivi ou compléments d'experts.",
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
