import type { ChatMessage } from "@/lib/types";
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  userInput: Annotation<ChatMessage>(),
  
  enhancedPrompt: Annotation<
    | {
        triageResult: {
          sector: string;
          function: string;
        };
        geographic_reference?: string;
        timeframe?: string;
        specific_factors_mentioned?: string[];
        analysis_type: string;
        recommended_framework: string;
        framework_components: Array<{
          component: string;
          description: string;
          required_data: string[];
          analysis_approach: string;
        }>;
        smart_requirements: any;
        output_structure: any;
        enhanced_prompt: string;
      }
    | undefined
  >(),

  scope: Annotation<any | undefined>(),
  dataSources: Annotation<any | undefined>(),
  searchResults: Annotation<any | undefined>(),
  dataGaps: Annotation<any | undefined>(),
  analysisResults: Annotation<any | undefined>(),
  presentation: Annotation<any | undefined>(),
  review: Annotation<
    | {
        checklist_completion: number;
        data_gaps_identified: boolean;
        trusted_sources_used: boolean;
        format_correct: boolean;
        quality_score: number;
        revisions_needed: string[];
      }
    | undefined
  >(),

  // Execution tracking
  currentAgent: Annotation<string>(),
  executionHistory:
    Annotation<
      Array<{
        agent: string;
        timestamp: Date;
        status: "started" | "completed" | "error";
        output?: any;
      }>
    >(),
});

// Keep your existing interface for type safety in agents
export type AgentStateType = {
  userInput: string;
  userProfile?: any;
  triageResult?: any;
  enhancedPrompt?: any;
  scope?: any;
  dataSources?: any;
  searchResults?: any;
  dataGaps?: any;
  analysisResults?: any;
  presentation?: any;
  review?: any;
  currentAgent?: string;
  executionHistory: Array<any>;
};

export type AgentNode = (
  state: AgentStateType
) => Promise<Partial<AgentStateType>>;
