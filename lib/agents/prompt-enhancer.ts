import { normalizeUserInput } from '@/utils/normalize-user-input';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { AgentNode } from './graph-state';

export type UserInput =
  | string
  | {
      role?: string;
      parts?: string[];
      content?: string;
    }
  | Array<{
      role?: string;
      parts?: string[];
      content?: string;
    }>;


// FRAMEWORK SETUP
const FRAMEWORKS = {
  "Porter's Five Forces": {
    components: [
      'Competitive Rivalry',
      'Threat of New Entrants',
      'Threat of Substitutes',
      'Bargaining Power of Buyers',
      'Bargaining Power of Suppliers',
    ],
    description: 'Industry analysis framework for business strategy',
  },
  'SWOT Analysis': {
    components: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
    description: 'Strategic planning technique',
  },
  'PESTLE Analysis': {
    components: [
      'Political',
      'Economic',
      'Social',
      'Technological',
      'Legal',
      'Environmental',
    ],
    description: 'Macro-environmental analysis framework',
  },
};

// Converts the framework repository into a readable text format
function getFrameworksDescription(): string {
  return Object.entries(FRAMEWORKS)
    .map(
      ([name, { description, components }]) =>
        `${name}: ${description}\nComponents: ${components.join(', ')}`
    )
    .join('\n\n');
}

export const promptEnhancerAgent: AgentNode = async (state) => {
  try {
    const currentMessage = normalizeUserInput(state.userInput);

    if (!currentMessage) {
      return {
        executionHistory: [
          ...state.executionHistory,
          {
            agent: "prompt_enhancer",
            timestamp: new Date(),
            status: "error",
            output: "No message content found"
          }
        ]
      };
    }

    // Prompt Definition
    const systemPrompt = `
      You are a Prompt Enhancer AI. Your goal is to analyze the user's query and craft a SMART, framework-based enhanced prompt.

      AVAILABLE FRAMEWORKS:
      ${getFrameworksDescription()}

      Steps to follow:
      1. Identify the main analysis goal.
      2. Choose the most relevant framework.
      3. Expand its components with specific analysis requirements.
      4. Apply SMART criteria (Specific, Measurable, Attainable, Relevant, Time-bound).
      5. Suggest an organized output structure.

      Return your reasoning and final enhanced prompt in the same language as the query in structured format.`;

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', 'User query: {input}'],
    ]);

    // Model Configuration
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY,
    });

    // Expected Output Schema
    const schema = z.object({
      analysis_type: z.enum([
        'market_analysis',
        'competitive_analysis',
        'strategic_planning',
        'risk_assessment',
        'investment_analysis',
        'operational_optimization',
        'customer_analysis',
        'product_development',
      ]),
      recommended_framework: z.string(),
      framework_components: z.array(
        z.object({
          component: z.string(),
          description: z.string(),
          required_data: z.array(z.string()),
          analysis_approach: z.string(),
        })
      ),
      smart_requirements: z.object({
        specific: z.array(z.string()),
        measurable: z.array(z.string()),
        attainable: z.array(z.string()),
        relevant: z.array(z.string()),
        time_bound: z.array(z.string()),
      }),
      output_structure: z.object({
        sections: z.array(
          z.object({
            section_title: z.string(),
            section_order: z.number(),
            components_included: z.array(z.string()),
            content_requirements: z.string(),
          })
        ),
        grouping_logic: z.string(),
      }),
      enhanced_prompt: z.string(),
    });

    // Run the AI Chain
    const structuredModel = model.withStructuredOutput(schema, {
      name: 'prompt_enhancer',
    });

    const chain = prompt.pipe(structuredModel);
    const result = await chain.invoke({ input: currentMessage });

    // Return state update instead of HTTP response
    return {
      enhancedPrompt: result,
      currentAgent: "prompt_enhancer",
      executionHistory: [
        ...state.executionHistory,
        {
          agent: "prompt_enhancer",
          timestamp: new Date(),
          status: "completed",
          output: result
        }
      ]
    };

  } catch (error: any) {
    console.log({error})
    return {
      executionHistory: [
        ...state.executionHistory,
        {
          agent: "prompt_enhancer",
          timestamp: new Date(),
          status: "error",
          output: error.message
        }
      ]
    };
  }
};