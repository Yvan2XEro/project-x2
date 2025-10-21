import { usedModel } from "@/lib/constants";
import { normalizeUserInput } from "@/utils/normalize-user-input";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { AgentNode } from "../graph-state/graph-state";

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

const FRAMEWORKS = {
  "SWOT Analysis": {
    components: ["Strengths", "Weaknesses", "Opportunities", "Threats"],
    description:
      "Strategic planning technique for identifying internal strengths/weaknesses and external opportunities/threats. Ideal for new ventures.",
  },
  "Porter's Five Forces": {
    components: [
      "Competitive Rivalry",
      "Threat of New Entrants",
      "Threat of Substitutes",
      "Bargaining Power of Buyers",
      "Bargaining Power of Suppliers",
    ],
    description:
      "Industry analysis framework for understanding competitive intensity and attractiveness. Highly relevant for market entry.",
  },
  "PESTLE Analysis": {
    components: [
      "Political",
      "Economic",
      "Social",
      "Technological",
      "Legal",
      "Environmental",
    ],
    description:
      "Macro-environmental analysis framework. Useful for broad context, but less specific to direct competitive threats/opportunities.",
  },
  "Combined SWOT & Porter's": {
    components: [
      "Strengths",
      "Weaknesses",
      "Opportunities",
      "Threats",
      "Competitive Rivalry",
      "Threat of New Entrants",
      "Threat of Substitutes",
      "Bargaining Power of Buyers",
      "Bargaining Power of Suppliers",
    ],
    description:
      "Comprehensive strategic framework integrating internal (SWOT) and external (Porter's) industry factors, ideal for market entry and competitive analysis.",
  },
};

function getFrameworksDescription(): string {
  return Object.entries(FRAMEWORKS)
    .map(
      ([name, { description, components }]) =>
        `### ${name}\nDescription: ${description}\nComponents: ${components.join(
          ", "
        )}`
    )
    .join("\n\n");
}

export const promptEnhancerAgent: AgentNode = async (state) => {
  try {
    const currentMessage = normalizeUserInput(state.userInput);
    console.log("currentMessage", { currentMessage });

    const systemPrompt = `
      You are a Prompt Enhancer AI. Your absolute priority is to meticulously analyze the *exact following user query* and generate an enhanced prompt *directly and based *solely* on its content*.

      --- START OF USER QUERY FOR ANALYSIS ---
      User Query: ${state.userInput} 
      ${state.userProfile ? `User Role: ${state.userProfile.role}` : ""} 
      ${
        state.userProfile
          ? `User Company: ${state.userProfile.company_name}`
          : ""
      } 
      --- END OF USER QUERY FOR ANALYSIS ---

      CRITICAL REQUIREMENTS:
    - The 'enhanced_prompt' and 'sector' fields MUST be derived *directly, precisely* and MUST directly reflect the specifics of the "User Query for Analysis" provided above. Do NOT introduce new topics or deviate from the original subject.
    - **EXTRACT AND PRESERVE ALL GEOGRAPHIC REFERENCES EXACTLY AS WRITTEN** (e.g., "Europe", "Africa", "Asia", "France"). If a geographic reference is present, it *must* be included in 'geographic_reference'.
    - **EXTRACT AND PRESERVE ALL TIME REFERENCES EXACTLY AS WRITTEN** (e.g., "2026", "next five years", "2023-2024"). If a time reference is present, it *must* be included in 'timeframe'.
    - PRESERVE all industry/sector references (e.g., "renewable energy", "healthcare", "electric vehicle industry").
    - PRESERVE all specific factors mentioned (e.g., "political factors", "economic factors", "opportunities", "threats", "new battery startup").
    - CHOOSE and APPLY the framework that BEST matches the content and *specific analytical goal* of the "User Query for Analysis". For identifying opportunities and threats in a specific industry for a new launch, SWOT Analysis and Porter's Five Forces (or their combination) are usually most appropriate.

    AVAILABLE FRAMEWORKS:
      ${getFrameworksDescription()}

      Steps to follow to enhance the prompt for the "User Query for Analysis":
      1. Find the most appropriate sector and function *explicitly mentioned or implied by the User Query*.
      2. Identify the main analysis goal *as stated in the User Query*.
      3. **CRITICALLY IDENTIFY AND EXTRACT ANY GEOGRAPHIC REFERENCE *EXPLICITLY MENTIONED* IN THE USER QUERY.**
      4. **CRITICALLY IDENTIFY AND EXTRACT ANY TIMEFRAME *EXPLICITLY MENTIONED* IN THE USER QUERY.**
      5. Identify any specific factors mentioned *in the User Query*.
      6. Choose the single most relevant framework, or a combination if necessary, *that directly supports the User Query's analytical goal*.
      7. Expand its components with specific analysis requirements *directly related to the User Query's industry and context*.
      8. Apply SMART criteria (Specific, Measurable, Attainable, Relevant, Time-bound) tailored *precisely to the User Query's objectives and timeframe*.
      9. Suggest an organized output structure for the analysis *that logically presents findings pertinent to the User Query*.

    Return your analysis in the same language as the query, ensuring ALL original specifics are preserved and highlighted. The 'enhanced_prompt' field should be a concise, actionable summary of the user's original request, incorporating the chosen framework and SMART criteria, directly reflecting the "User Query for Analysis" and containing *all preserved details*.
    `;

    if (!currentMessage) {
      return {
        executionHistory: [
          ...state.executionHistory,
          {
            agent: "prompt_enhancer",
            timestamp: new Date(),
            status: "error",
            output: "No message content found",
          },
        ],
      };
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", "Please enhance the following query: {input}"],
    ]);

    const model = usedModel;

    const schema = z.object({
      triageResult: z.object({
        sector: z
          .string()
          .describe(
            "The business sector, e.g., Electric Vehicle Industry, Financial Services, Technology, Healthcare. MUST be derived from the user query."
          ),
        function: z
          .string()
          .describe(
            "The business function, e.g., Market Analysis, Sales Strategy, Risk Assessment, Strategic Planning."
          ),
      }),
      geographic_reference: z
        .string()
        .describe(
          "The geographic reference e.g., Africa, Europe, Asia. MUST be preserved from the user query."
        )
        .optional(),
      timeframe: z
        .string()
        .describe(
          "The timeframe e.g., next five years, 2023-2024, 2026. MUST be preserved from the user query."
        )
        .optional(),
      specific_factors_mentioned: z
        .array(z.string())
        .describe(
          "The specific factors mentioned e.g., political factors, economic factors, opportunities, threats, new battery startup. MUST be preserved from the user query."
        )
        .optional(),
      analysis_type: z
        .string()
        .describe(
          "The main analysis goal e.g., market analysis, competitive analysis, strategic planning, risk assessment, investment analysis, market entry strategy."
        ),
      recommended_framework: z
        .string()
        .describe(
          "The recommended framework e.g., Porter's Five Forces, SWOT Analysis, PESTLE Analysis, Combined SWOT & Porter's."
        ),
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
      enhanced_prompt: z
        .string()
        .describe(
          "A concise, actionable prompt that directly reflects the user's original query, incorporating the chosen framework and SMART criteria, and preserving all original specifics."
        ),
    });

    const structuredModel = model.withStructuredOutput(schema, {
      name: "prompt_enhancer",
    });

    const chain = prompt.pipe(structuredModel);
    const result = await chain.invoke({ input: state.userInput });
    // const result = fakeEnhancedPrompt;

    const data = {
      enhancedPrompt: result,
      currentAgent: "completed",
      executionHistory: [
        ...state.executionHistory,
        {
          agent: "prompt_enhancer",
          timestamp: new Date(),
          status: "completed",
          output: result,
        },
      ],
    };

    return data;
  } catch (error: any) {
    console.error("Error in prompt_enhancer agent:", { error });
    return {
      executionHistory: [
        ...state.executionHistory,
        {
          agent: "prompt_enhancer",
          timestamp: new Date(),
          status: "error",
          output: error.message,
        },
      ],
    };
  }
};
