import "server-only";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const usedModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-exp",
  temperature: 0.7,
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY,
});

// export const usedModel = new ChatGroq({
//   model: "groq-llama3-70b",
//   temperature: 0.7,
//   apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
// });

// export const usedModel = new ChatAnthropic({
//   model: "claude-3-5-sonnet-20241022",
//   temperature: 0.7,
//   apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
// });
