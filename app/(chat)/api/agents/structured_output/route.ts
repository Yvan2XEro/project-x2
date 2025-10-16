import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'edge';

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

// API ENDPOINT
export async function POST(req: NextRequest) {
  try {
    const { messages = [] } = await req.json();

    // Extract the latest user message text
    const lastMessage = messages[messages.length - 1];
    const currentMessage =
      lastMessage?.parts
        ?.filter((part: any) => part.type === 'text')
        ?.map((part: any) => part.text)
        ?.join(' ')
        ?.trim() || '';

    if (!currentMessage) {
      return NextResponse.json(
        { error: 'No message content found' },
        { status: 400 }
      );
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
    // const model = new ChatOpenAI({
    //   temperature: 0.7,
    //   model: "gpt-4o",
    // });

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
        specific: z.array(
          z.string().describe('Specific aspect that must be analyzed')
        ),
        measurable: z.array(
          z.string().describe('Quantifiable metrics and KPIs to include')
        ),
        attainable: z.array(
          z.string().describe('Realistic data sources and methods')
        ),
        relevant: z.array(
          z.string().describe('Relevance to the original query context')
        ),
        time_bound: z.array(
          z.string().describe('Timeframes and temporal considerations')
        ),
      }),
      output_structure: z.object({
        sections: z
          .array(
            z.object({
              section_title: z.string(),
              section_order: z.number(),
              components_included: z.array(z.string()),
              content_requirements: z.string(),
            })
          )
          .describe('The optimal output structure and grouping logic'),
        grouping_logic: z
          .string()
          .describe('How information should be grouped and organized'),
      }),
      enhanced_prompt: z
        .string()
        .describe(
          'The final enhanced prompt incorporating all SMART criteria and framework components'
        ),
    });

    // Run the AI Chain
    const structuredModel = model.withStructuredOutput(schema, {
      name: 'prompt_enhancer',
    });

    const chain = prompt.pipe(structuredModel);

    const result = await chain.invoke({ input: currentMessage });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Prompt Enhancer Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
