import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: [
      "chat-model",
      "chat-model-reasoning",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash-thinking-exp-1219",
      "command-a-03-2025",
      "command-a-reasoning-08-2025",
      "groq-llama3-70b",
    ],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      "chat-model",
      "chat-model-reasoning",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash-thinking-exp-1219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "command-a-03-2025",
      "command-a-reasoning-08-2025",
      "groq-llama3-70b",
      "grok-3-reasoning",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
