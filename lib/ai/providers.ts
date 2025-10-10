import { createAnthropic } from "@ai-sdk/anthropic";
import { createCohere } from "@ai-sdk/cohere";
import { gateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const cohere = createCohere({
  apiKey: process.env.NEXT_PUBLIC_COHERE_API_KEY,
});
const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
});

const groq = createGroq({ // Add this instantiation
  apiKey: process.env.GROQ_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
        geminiFlashModel,
        geminiThinkingModel,
        claudeSonnetModel,
        claudeHaikuModel,
        cohereCommandAModel,
        cohereCommandReasoningModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
          "gemini-2.0-flash-exp": geminiFlashModel,
          "gemini-2.0-flash-thinking-exp-1219": geminiThinkingModel,
          "claude-3-5-sonnet-20241022": claudeSonnetModel,
          "claude-3-5-haiku-20241022": claudeHaikuModel,
          "command-a-03-2025": cohereCommandAModel,
          "command-a-reasoning-08-2025": cohereCommandReasoningModel,
          "grok-3-reasoning": require("./models.mock").grok3ReasoningModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
        "chat-model-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        // "title-model": gateway.languageModel("xai/grok-2-1212"),
        // "artifact-model": gateway.languageModel("xai/grok-2-1212"),
        "title-model": google.languageModel("gemini-2.0-flash-exp"),
        "artifact-model": google.languageModel("gemini-2.0-flash-exp"),
        "gemini-2.0-flash-exp": google.languageModel("gemini-2.0-flash-exp"),
        "gemini-2.0-flash-thinking-exp-1219": wrapLanguageModel({
          model: google.languageModel("gemini-2.0-flash-thinking-exp-1219"),
          middleware: extractReasoningMiddleware({ tagName: "thinking" }),
        }),
        "claude-3-5-sonnet-20241022": wrapLanguageModel({
          model: anthropic("claude-3-5-sonnet-20241022") as any,
          middleware: extractReasoningMiddleware({ tagName: "thinking" }),
        }),
        "claude-3-5-haiku-20241022": anthropic(
          "claude-3-5-haiku-20241022"
        ) as any,
        "command-a-03-2025": cohere.languageModel("command-a-03-2025"),
        "command-a-reasoning-08-2025": wrapLanguageModel({
          model: cohere.languageModel("command-a-reasoning-08-2025") as any,
          middleware: extractReasoningMiddleware({ tagName: "thinking" }),
        "groq-llama3-70b": groq("llama-3.3-70b-versatile"),
        "grok-3-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3"), // Base Grok 3 model ID from xAI
          middleware: extractReasoningMiddleware({ tagName: "think" }), // Enables chain-of-thought
        }),
      },
    });
