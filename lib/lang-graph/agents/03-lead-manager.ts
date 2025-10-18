import { usedModel } from "@/lib/constants";
import { z } from "zod";
import { AgentNode, AgentStateType } from "../graph-state/graph-state";

export const leadManagerAgent: AgentNode = async (state: AgentStateType) => {
  const { enhancedPrompt, triageResult } = state;

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
    };
  }
  
  const model = usedModel;

  const schema = z.object({
    project_title: z.string(),
    total_sections: z.number(),
    estimated_completion_time: z.string(),
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
        estimated_duration: z.string(),
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

  const structuredModel = model.withStructuredOutput(schema);

  const result = await structuredModel.invoke(`
    You are a Lead Manager AI. Your task is to break down the enhanced analysis prompt into manageable sections and create an execution plan.

    CONTEXT:
    - Sector: ${triageResult?.sector || "Unknown"}
    - Function: ${triageResult?.function || "Unknown"} 
    - Framework: ${enhancedPrompt.recommended_framework}
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
    6. Estimate timelines and priorities

    Return a comprehensive scope and execution plan.
  `);

  return {
    scope: result,
    currentAgent: "lead_manager",
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
};
