import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
// import { ChatAnthropic } from "@langchain/anthropic";
// import { ChatGroq } from "@langchain/groq";
import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

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

