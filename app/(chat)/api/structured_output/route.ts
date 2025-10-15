import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const FRAMEWORK_REPOSITORY = {
  "Porter's Five Forces": {
    components: [
      "Competitive Rivalry",
      "Threat of New Entrants", 
      "Threat of Substitutes",
      "Bargaining Power of Buyers",
      "Bargaining Power of Suppliers"
    ],
    description: "Industry analysis framework for business strategy"
  },
  "SWOT Analysis": {
    components: [
      "Strengths",
      "Weaknesses", 
      "Opportunities",
      "Threats"
    ],
    description: "Strategic planning technique"
  },
  "PESTLE Analysis": {
    components: [
      "Political",
      "Economic",
      "Social", 
      "Technological",
      "Legal",
      "Environmental"
    ],
    description: "Macro-environmental analysis framework"
  }
};

// Convert framework repository to a safe string format
const getFrameworkRepositoryText = () => {
  let frameworkText = "";
  for (const [framework, details] of Object.entries(FRAMEWORK_REPOSITORY)) {
    frameworkText += `${framework}: ${details.description}\n`;
    frameworkText += `Components: ${details.components.join(", ")}\n\n`;
  }
  return frameworkText.trim();
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    
    // Extract message content from parts
    const lastMessage = messages[messages.length - 1];
    let currentMessageContent = "";

    if (lastMessage?.parts && Array.isArray(lastMessage.parts)) {
      const textParts = lastMessage.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text);
      currentMessageContent = textParts.join(' ');
    }

    if (!currentMessageContent.trim()) {
      return NextResponse.json({ 
        error: "No message content found" 
      }, { status: 400 });
    }

    // Create the system message without template variables
    const systemMessage = `You are a Prompt Enhancer AI. Deeply analyze the user's query to identify the optimal business framework and create an enhanced SMART prompt.

    AVAILABLE FRAMEWORKS:
    ${getFrameworkRepositoryText()}

    Your task:
    1. Identify the core analysis need from the query
    2. Select the most appropriate framework from the repository
    3. Break down all framework components with specific analysis requirements
    4. Apply SMART criteria to make the analysis actionable
    5. Define the optimal output structure and grouping

    Return your analysis in the structured format.`;

    // Use a simpler template approach
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      ["human", "User query: {input}"]
    ]);

    const model = new ChatOpenAI({
      temperature: 0.7,
      model: "gpt-4o",
    });

    const schema = z.object({
      analysis_type: z.enum([
        "market_analysis",
        "competitive_analysis", 
        "strategic_planning",
        "risk_assessment",
        "investment_analysis",
        "operational_optimization",
        "customer_analysis",
        "product_development"
      ]).describe("The primary type of analysis needed"),
      
      recommended_framework: z.string().describe("The most appropriate framework to use"),
      
      framework_components: z.array(z.object({
        component: z.string().describe("Specific component of the framework"),
        description: z.string().describe("What this component analyzes"),
        required_data: z.array(z.string()).describe("Data points needed for this component"),
        analysis_approach: z.string().describe("How to approach analyzing this component")
      })),
      
      smart_requirements: z.object({
        specific: z.array(z.string()).describe("Specific aspects that must be analyzed"),
        measurable: z.array(z.string()).describe("Quantifiable metrics and KPIs to include"),
        attainable: z.array(z.string()).describe("Realistic data sources and methods"),
        relevant: z.array(z.string()).describe("Relevance to the original query context"),
        time_bound: z.array(z.string()).describe("Timeframes and temporal considerations")
      }),
      
      output_structure: z.object({
        sections: z.array(z.object({
          section_title: z.string(),
          section_order: z.number(),
          components_included: z.array(z.string()),
          content_requirements: z.string()
        })),
        grouping_logic: z.string().describe("How information should be grouped and organized")
      }),
      
      enhanced_prompt: z.string().describe("The final enhanced prompt incorporating all SMART criteria and framework components")
    });

    const functionCallingModel = model.withStructuredOutput(schema, {
      name: "prompt_enhancer",
    });

    const chain = prompt.pipe(functionCallingModel);
    const result = await chain.invoke({ 
      input: currentMessageContent 
    });

    return NextResponse.json(result);
    
  } catch (e: any) {
    console.error("Error in prompt enhancer:", e);
    return NextResponse.json({ 
      error: e.message 
    }, { status: 500 });
  }
}