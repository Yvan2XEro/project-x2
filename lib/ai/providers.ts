import { createAnthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
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
      },
    });
