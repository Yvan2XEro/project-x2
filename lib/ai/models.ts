export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Grok Vision",
    description: "Advanced multimodal model with vision and text capabilities",
  },
  {
    id: "chat-model-reasoning",
    name: "Grok Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    description: "Fast and efficient multimodal model from Google",
  },
  {
    id: "gemini-2.0-flash-thinking-exp-1219",
    name: "Gemini 2.0 Flash Thinking",
    description: "Gemini with extended thinking capabilities",
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Powerful model with extended thinking and analysis",
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    description: "Fast and efficient model for quick responses",
  },
  {
    id: "command-a-03-2025",
    name: "Cohere Command A",
    description: "Fast and efficient model for quick responses",
  },
  {
    id: "command-a-reasoning-08-2025",
    name: "Cohere Command A Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
];
