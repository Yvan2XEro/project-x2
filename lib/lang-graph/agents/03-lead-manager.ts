import { usedModel } from "@/lib/ai/server-models";
import { z } from "zod";
import { AgentNode, AgentStateType } from "../graph-state/graph-state";

export const leadManagerAgent: AgentNode = async (state: AgentStateType) => {
  try {
    const { enhancedPrompt } = state;
    const model = usedModel;

    if (!enhancedPrompt) {
      return {
        executionHistory: [
          ...state.executionHistory,
          {
            agent: "lead_manager",
            timestamp: new Date(),
            status: "error",
            output: "No enhanced prompt available for scope planning",
          },
        ],
        currentAgent: "completed",
      };
    }

    const schema = z.object({
      project_title: z.string(),
      total_sections: z.number(),
      execution_strategy: z.enum([
        "fully_parallel",
        "fully_sequential",
        "hybrid",
      ]),
      sections: z.array(
        z.object({
          section_id: z.string(),
          title: z.string(),
          description: z.string(),
          assigned_agents: z.array(z.string()),
          checklist: z.array(z.string()),
          dependencies: z.array(z.string()),
          priority: z.enum(["critical", "high", "medium", "low"]),
          data_requirements: z.array(z.string()),
          success_criteria: z.array(z.string()),
        })
      ),
      risk_assessment: z.object({
        data_availability_risk: z.enum(["low", "medium", "high"]),
        complexity_risk: z.enum(["low", "medium", "high"]),
        timeline_risk: z.enum(["low", "medium", "high"]),
        mitigation_strategy: z.string(),
      }),
    });

    console.log({triager: enhancedPrompt.triageResult})

    const structuredModel = model.withStructuredOutput(schema);
    const systemMessage = `
    You are a Lead Manager AI. Your task is to break down the enhanced analysis prompt into manageable sections and create an execution plan.

    CONTEXT:
    - Sector: ${enhancedPrompt.triageResult?.sector || enhancedPrompt?.sector || "Unknown"}
    - Function: ${enhancedPrompt.triageResult?.function || enhancedPrompt?.function || "Unknown"} 
    - Category: ${enhancedPrompt.triageResult?.category || enhancedPrompt?.category || "Unknown"}
    - Confidence Score: ${enhancedPrompt.triageResult?.confidenceScore || enhancedPrompt?.confidenceScore || "Unknown"}
    - Framework: ${enhancedPrompt.recommended_framework}
    - Geographic Scope: ${enhancedPrompt.geographic_reference || "Global"}
    - Timeframe: ${enhancedPrompt.timeframe || "Not specified"}
    - Analysis Type: ${enhancedPrompt.analysis_type}

    ENHANCED PROMPT REQUIREMENTS:
    ${JSON.stringify(enhancedPrompt.smart_requirements, null, 2)}

    FRAMEWORK COMPONENTS TO COVER:
    ${enhancedPrompt.framework_components
      .map((comp: any) => `- ${comp.component}: ${comp.description}`)
      .join("\n")}

    OUTPUT STRUCTURE EXPECTED:
    ${enhancedPrompt.output_structure.grouping_logic}

    AVAILABLE SPECIALIST AGENTS:
    - data_source_manager: Finds and validates data sources
    - data_searcher: Performs web, proprietary, and file searches
    - data_analyzer: Runs statistical and trend analysis
    - expert_input: Identifies knowledge gaps
    - data_presenter: Formats output with visualizations

    TASK:
    1. Break down the analysis into logical sections based on the framework
    2. Assign the right specialist agents to each section
    3. Create detailed checklists for each section
    4. Identify dependencies between sections
    5. Assess risks and create mitigation strategies

    Return a comprehensive scope in the same language as the query and execution plan WITHOUT time estimates.
  `;
    const result = await structuredModel.invoke(systemMessage);
  //  const result = fakeLeadManagerResult;

  console.log(JSON.stringify(result, null, 2))

    const data = {
      scope: result,
      currentAgent: "completed",
      executionHistory: [
        ...state.executionHistory,
        {
          agent: "lead_manager",
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
