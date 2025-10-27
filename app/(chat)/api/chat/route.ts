import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUser,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { AgentOrchestrator } from "@/lib/lang-graph/orchestrator/orchestrator";
import type { RenderedDeliverable } from "@/lib/lang-graph/types";
import type { AgentTimelineStep, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const runtime = "nodejs";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

type PlanningPromptInput = {
  finalState: any;
  latestUserMessage: string;
};

function buildPlanningPrompt({
  finalState,
  latestUserMessage,
}: PlanningPromptInput): string | null {
  if (!finalState) {
    return null;
  }

  const lines: string[] = [];
  const trimmedQuestion = latestUserMessage.trim();

  if (trimmedQuestion) {
    lines.push(`User question: ${trimmedQuestion}`);
  }

  const enhanced = finalState.enhancedPrompt;
  if (enhanced?.enhanced_prompt) {
    lines.push(`Enhanced analysis brief: ${enhanced.enhanced_prompt}`);
  }

  if (enhanced?.recommended_framework) {
    lines.push(
      `Recommended framework: ${enhanced.recommended_framework} | Analysis type: ${enhanced.analysis_type ?? "N/A"}`
    );
  }

  const sections = Array.isArray(finalState.scope?.sections)
    ? finalState.scope.sections
    : [];

  if (sections.length > 0) {
    const sectionLines = sections.map((section: any, index: number) => {
      const checklist = Array.isArray(section.checklist)
        ? section.checklist.slice(0, 2).join("; ")
        : "";
      return `${index + 1}. ${section.title} – ${section.description ?? ""}${
        checklist ? ` (focus: ${checklist})` : ""
      }`;
    });

    lines.push(`Planned sections:\n${sectionLines.join("\n")}`);
  }

  const recommendedSources = Array.isArray(
    finalState.dataSources?.data_source_manager?.recommended_sources
  )
    ? finalState.dataSources.data_source_manager.recommended_sources
    : [];

  if (recommendedSources.length > 0) {
    const sourceLines = recommendedSources.map(
      (source: any) => `${source.name} (${source.trustLevel}, ${source.access})`
    );

    lines.push(`Primary sources: ${sourceLines.join(", ")}`);
  }

  const contextKeywords = Array.isArray(finalState.dataConnections?.context?.keywords)
    ? finalState.dataConnections.context.keywords
    : [];

  if (contextKeywords.length > 0) {
    lines.push(`Focus keywords: ${contextKeywords.join(", ")}`);
  }

  if (lines.length === 0) {
    return null;
  }

  lines.push(
    "Using the context above, produce the full research response with an executive summary, analytical sections, and explicit source references."
  );

  lines.push("Respond in the same language as the user question.");

  return lines.join("\n\n");
}

function renderDeliverableToMarkdown(deliverable: RenderedDeliverable): string {
  const lines: string[] = [];

  const headline = deliverable.executiveSummary.headline || "Livrable";
  lines.push(`# ${headline}`);
  lines.push(
    `**Mode:** ${deliverable.mode === "exec" ? "Executive" : "Détaillé"} · **Locale:** ${deliverable.locale} · **Template:** ${deliverable.template}`
  );

  for (const paragraph of deliverable.executiveSummary.body) {
    if (paragraph.trim().length > 0) {
      lines.push(paragraph.trim());
    }
  }

  if (deliverable.executiveSummary.highlights.length > 0) {
    lines.push("### Points clés");
    const highlightLines: string[] = [];
    for (const highlight of deliverable.executiveSummary.highlights) {
      highlightLines.push(`- ${highlight}`);
    }
    lines.push(highlightLines.join("\n"));
  }

  for (const [index, section] of deliverable.sections.entries()) {
    lines.push(`## ${index + 1}. ${section.title}`);

    if (section.summary.length > 0) {
      const summaryBullets: string[] = [];
      for (const point of section.summary) {
        summaryBullets.push(`- ${point}`);
      }
      lines.push(summaryBullets.join("\n"));
    }

    if (section.dataHighlights.length > 0) {
      lines.push("**Données clés :**");
      const highlightBullets: string[] = [];
      for (const item of section.dataHighlights) {
        highlightBullets.push(`- ${item}`);
      }
      lines.push(highlightBullets.join("\n"));
    }

    if (section.visuals.length > 0) {
      lines.push("**Visuels pré-rendus :**");
      const visualBullets: string[] = [];
      for (const visual of section.visuals) {
        visualBullets.push(`- ${visual.type === "chart" ? "Graphique" : "Tableau"} · ${visual.title} (source : ${visual.source})`);
      }
      lines.push(visualBullets.join("\n"));
    }

    lines.push(`> ${section.narrative}`);
  }

  if (deliverable.appendices.length > 0) {
    lines.push("### Annexes prévues");
    const appendixBullets: string[] = [];
    for (const appendix of deliverable.appendices) {
      appendixBullets.push(`- ${appendix}`);
    }
    lines.push(appendixBullets.join("\n"));
  }

  if (deliverable.exports.length > 0) {
    lines.push("### Exports planifiés");
    const exportBullets: string[] = [];
    for (const currentExport of deliverable.exports) {
      exportBullets.push(`- ${currentExport.format.toUpperCase()} · ${currentExport.filename} (${currentExport.status})`);
    }
    lines.push(exportBullets.join("\n"));
  }

  if (deliverable.citations.bibliography.length > 0) {
    lines.push("### Sources et citations");
    const citationLines: string[] = [];
    for (const citation of deliverable.citations.bibliography) {
      citationLines.push(`- [${citation.id}] ${citation.title} — ${citation.publisher} (${citation.trustLevel}, accès ${citation.access})`);
    }
    lines.push(citationLines.join("\n"));
  }

  lines.push("### Accessibilité");
  const accessibilityBullets: string[] = [];
  for (const item of deliverable.accessibility.checklist) {
    accessibilityBullets.push(`- ${item}`);
  }
  lines.push(accessibilityBullets.join("\n"));

  lines.push(
    `**Internationalisation :** fuseau ${deliverable.internationalization.timezone} · formatage ${deliverable.numberFormat} · dates ${deliverable.dateFormat}`
  );

  return lines.join("\n\n");
}

function buildPackagingMessage(deliverable: RenderedDeliverable): ChatMessage {
  const markdown = renderDeliverableToMarkdown(deliverable);
  return {
    id: generateUUID(),
    role: "assistant",
    parts: [
      {
        type: "text",
        text: markdown,
      },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
    },
  };
}

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

const AGENT_TITLES: Record<string, string> = {
  prompt_enhancer: "Prompt enhancement",
  lead_manager: "Scope planning",
  data_source_manager: "Source management",
  data_connector: "Data connections",
  data_searcher: "Search plan",
  expert_input: "Expert escalation",
  data_analyzer: "Analysis modelling",
  data_presenter: "Presentation",
  render_packager: "Rendering & packaging",
  reviewer: "Quality review",
};

function formatTimelineDetails(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}…` : trimmed;
  }

  if (typeof value === "object") {
    try {
      const serialized = JSON.stringify(value, null, 2);
      return serialized.length > 2000
        ? `${serialized.slice(0, 2000)}…`
        : serialized;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function summarizeTimelineStep(agent: string, finalState: any): string {
  switch (agent) {
    case "prompt_enhancer":
      if (finalState.enhancedPrompt?.enhanced_prompt) {
        return `Enhanced prompt prepared using ${finalState.enhancedPrompt.recommended_framework}.`;
      }
      return "Prompt enhancement completed.";
    case "lead_manager":
      if (finalState.scope?.total_sections) {
        const total = finalState.scope.total_sections as number;
        return `Execution scope organised into ${total} section${total === 1 ? "" : "s"}.`;
      }
      return "Scope planning completed.";
    case "data_source_manager": {
      const recommended =
        finalState.dataSources?.data_source_manager?.recommended_sources
          ?.length ?? 0;
      if (recommended) {
        return `Selected ${recommended} preferred data source${recommended === 1 ? "" : "s"}.`;
      }
      return "Source curation finished.";
    }
    case "data_connector": {
      const available = finalState.dataConnections?.connections?.length ?? 0;
      if (available) {
        return `Prepared ${available} connection${available === 1 ? "" : "s"} for data ingestion.`;
      }
      return "Data connection planning completed.";
    }
    case "data_searcher": {
      const totalTasks = finalState.searchResults?.tasks?.length ?? 0;
      const snowflakeHits =
        finalState.searchResults?.snowflake?.results?.filter((result: any) =>
          Array.isArray(result.rows) ? result.rows.length > 0 : false
        ).length ?? 0;
      if (totalTasks) {
        return snowflakeHits
          ? `Compiled ${totalTasks} search task${totalTasks === 1 ? "" : "s"} with ${snowflakeHits} Snowflake result${snowflakeHits === 1 ? "" : "s"}.`
          : `Compiled ${totalTasks} search task${totalTasks === 1 ? "" : "s"}.`;
      }
      return "Search plan generated.";
    }
    case "expert_input": {
      const gaps = finalState.dataGaps?.gaps?.length ?? 0;
      if (gaps) {
        return `Flagged ${gaps} data gap${gaps === 1 ? "" : "s"} for expert review.`;
      }
      return "No expert escalation required.";
    }
    case "data_analyzer": {
      const components = finalState.analysisResults?.components?.length ?? 0;
      if (components) {
        return `Outlined ${components} analysis component${components === 1 ? "" : "s"}.`;
      }
      return "Analysis plan assembled.";
    }
    case "data_presenter": {
      const sections = finalState.presentation?.sections?.length ?? 0;
      if (sections) {
        return `Presentation scaffold includes ${sections} section${sections === 1 ? "" : "s"}.`;
      }
      return "Presentation scaffolding completed.";
    }
    case "render_packager": {
      const mode = finalState.renderedDeliverable?.mode ?? "exec";
      const exports = finalState.renderedDeliverable?.exports?.length ?? 0;
      if (exports) {
        return `Deliverable packaged in ${exports} export format${exports === 1 ? "" : "s"} (${mode} mode).`;
      }
      return `Deliverable packaging completed (${mode} mode).`;
    }
    case "reviewer": {
      const score = finalState.review?.quality_score;
      if (typeof score === "number") {
        return `Quality score: ${(score * 100).toFixed(0)}%.`;
      }
      return "Quality control check completed.";
    }
    default:
      return `${agent.replace(/_/g, " ")} completed.`;
  }
}

function buildAgentTimeline(state: any): AgentTimelineStep[] {
  const history = Array.isArray(state?.executionHistory)
    ? state.executionHistory
    : [];

  return history.map((item: any) => {
    const agent = String(item.agent ?? "agent");
    const status = (item.status ?? "completed") as AgentTimelineStep["status"];
    const summary = summarizeTimelineStep(agent, state);
    const details = formatTimelineDetails(item.output);
    const timestamp = item.timestamp instanceof Date
      ? item.timestamp.toISOString()
      : typeof item.timestamp === "string"
        ? item.timestamp
        : undefined;

    return {
      agent,
      title: AGENT_TITLES[agent] ?? agent.replace(/_/g, " "),
      status,
      summary,
      details,
      timestamp,
    };
  });
}

function mergeAgentState(currentState: any, update: any) {
  if (!update || typeof update !== "object") {
    return currentState;
  }

  const nextState = {
    ...currentState,
    ...update,
  };

  if (Array.isArray(update.executionHistory)) {
    nextState.executionHistory = update.executionHistory;
  }

  return nextState;
}

function normaliseGraphValue<T>(value: T): T {
  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([key, entryValue]) => [key, normaliseGraphValue(entryValue)]);
    return Object.fromEntries(entries) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normaliseGraphValue(item)) as T;
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    let mutated = false;

    for (const [key, entryValue] of Object.entries(value)) {
      const normalisedEntry = normaliseGraphValue(entryValue);
      next[key] = normalisedEntry;
      mutated ||= normalisedEntry !== entryValue;
    }

    if (mutated) {
      return next as T;
    }
  }

  return value;
}

function extractStateUpdate(chunk: any) {
  if (!chunk) {
    return null;
  }

  if (chunk instanceof Map) {
    return normaliseGraphValue(Object.fromEntries(chunk));
  }

  if (Array.isArray(chunk)) {
    const [channel, payload] = chunk as [unknown, unknown];
    if (channel !== "values") {
      return null;
    }

    if (payload instanceof Map) {
      return normaliseGraphValue(Object.fromEntries(payload));
    }

    return normaliseGraphValue(payload ?? null);
  }

  if (typeof chunk === "object") {
    if (chunk && "value" in chunk && typeof (chunk as any).value === "object") {
      const value = (chunk as any).value;
      if (value instanceof Map) {
        return normaliseGraphValue(Object.fromEntries(value));
      }
      return normaliseGraphValue(value);
    }
    return normaliseGraphValue(chunk);
  }

  return null;
}

export async function POST(request: Request) {
  const rateLimitDisabled =
    process.env.CHAT_DISABLE_RATE_LIMIT === "true" ||
    process.env.NEXT_PUBLIC_CHAT_DISABLE_RATE_LIMIT === "true";

  let requestBody: PostRequestBody;
  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }
    let userProfile: User | undefined;

    if (session.user.email && session.user.type !== "guest") {
      userProfile = (await getUser(session.user.email))[0];
    }

    const userType: UserType = session.user.type;

    if (!rateLimitDisabled) {
      const messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 24,
      });

      if (messageCount >= entitlementsByUserType[userType].maxMessagesPerDay) {
        return new ChatSDKError("rate_limit:chat").toResponse();
      }
    }

    const chat = await getChatById({ id });

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const orchestrator = new AgentOrchestrator();

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const modelMessages = [...convertToModelMessages(uiMessages)];
        const userQuestion = getTextFromMessage(message);
        let currentState: any = {
          userInput: userQuestion,
          userProfile,
          executionHistory: [],
        };
        let lastTimelineSignature = "";

        const emitTimeline = () => {
          const timeline = buildAgentTimeline(currentState);
          if (!timeline.length) {
            return;
          }
          const signature = timeline
            .map((step) => `${step.agent}:${step.status}`)
            .join("|");
          if (signature === lastTimelineSignature) {
            return;
          }
          lastTimelineSignature = signature;
          dataStream.write({ type: "data-agentTimeline", data: timeline });
        };

        try {
          for await (const chunk of orchestrator.executeStream(
            userQuestion,
            userProfile
          )) {
            const update = extractStateUpdate(chunk);
            if (update) {
              currentState = mergeAgentState(currentState, update);
            }
            emitTimeline();
          }
        } catch (error) {
          console.error("Agent pipeline stream failed", error);
        }

        // if (!currentState.renderedDeliverable) {
        //   try {
        //     const completedState = await orchestrator.execute(
        //       message,
        //       userProfile
        //     );
        //     currentState = mergeAgentState(currentState, completedState);
        //     emitTimeline();
        //   } catch (error) {
        //     console.error("Fallback agent execution failed", error);
        //   }
        // }

        let deliverable = currentState.renderedDeliverable as RenderedDeliverable | undefined;
        if (!deliverable) {
          try {
            const completedState = await orchestrator.execute(
              userQuestion,
              userProfile
            );
            const finalUpdate = extractStateUpdate(completedState);
            if (finalUpdate) {
              currentState = mergeAgentState(currentState, finalUpdate);
            }
            emitTimeline();
            deliverable = currentState.renderedDeliverable as RenderedDeliverable | undefined;
          } catch (error) {
            console.error("Fallback agent execution failed", error);
          }
        }

        console.log("\n\n\n Route deliverable response");
        console.log(JSON.stringify(deliverable, null, 2));
        console.log("\n\n\n");

        if (deliverable) {
          emitTimeline();
          const packagingMessage = buildPackagingMessage(deliverable);
          dataStream.write({
            type: "data-appendMessage",
            data: JSON.stringify(packagingMessage),
          });
          return;
        }

        const planningPrompt = buildPlanningPrompt({
          finalState: currentState,
          latestUserMessage: userQuestion,
        });

        if (planningPrompt) {
          modelMessages.push({
            role: "user",
            content: planningPrompt,
          });
        }

        emitTimeline();

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === "chat-model-reasoning"
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              // const modelId = "claude-3-5-sonnet-20241022";
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        // result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
