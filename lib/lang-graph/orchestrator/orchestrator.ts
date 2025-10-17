import { END, StateGraph } from "@langchain/langgraph";
import { triagerAgent } from "../agents/01-triager";
import { promptEnhancerAgent } from "../agents/02-prompt-enhancer";
import { leadManagerAgent } from "../agents/03-lead-manager";
import { dataSourceManagerAgent } from "../agents/04-data-source-manager";
import { dataSearcherAgent } from "../agents/06-data-searcher";
import { expertInputRequiredAgent } from "../agents/07-expert-input-required";
import { dataAnalyzerAgent } from "../agents/08-data-analyser";
import { dataPresenterAgent } from "../agents/09-data-presenter";
import { reviewerAgent } from "../agents/10-reviewer";
import { AgentState } from "../graph-state/graph-state";

export class AgentOrchestrator {
  private graph: any;

  constructor() {
    this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(AgentState);

    workflow.addNode("triager", triagerAgent);
    workflow.addNode("prompt_enhancer", promptEnhancerAgent);
    workflow.addNode("lead_manager", leadManagerAgent);
    workflow.addNode("data_source_manager", dataSourceManagerAgent);
    workflow.addNode("data_searcher", dataSearcherAgent);
    workflow.addNode("expert_input", expertInputRequiredAgent);
    workflow.addNode("data_analyzer", dataAnalyzerAgent);
    workflow.addNode("data_presenter", dataPresenterAgent);
    workflow.addNode("reviewer", reviewerAgent);

    workflow.setEntryPoint("triager");
    workflow.addEdge("triager", "prompt_enhancer");
    workflow.addEdge("prompt_enhancer", END);
    // workflow.addEdge("prompt_enhancer", "lead_manager");
    // workflow.addEdge("lead_manager", "data_source_manager");
    // workflow.addEdge("data_source_manager", "data_searcher");
    // workflow.addEdge("data_searcher", "expert_input");
    // workflow.addEdge("expert_input", "data_analyzer");
    // workflow.addEdge("data_analyzer", "data_presenter");
    // workflow.addEdge("data_presenter", "reviewer");
    // workflow.addEdge("reviewer", END);

    // Comment out conditional edges until reviewer is implemented
    /*
    workflow.addConditionalEdges(
      "reviewer",
      (state) => {
        if (state.review?.quality_score && state.review.quality_score >= 0.8) {
          return "end";
        }
        return "revise";
      },
      {
        end: END,
        revise: "data_analyzer",
      }
    );
    */

    this.graph = workflow.compile();
  }

  async execute(userInput: string, userProfile?: any): Promise<any> {
    const initialState = {
      userInput,
      userProfile,
      currentAgent: "triager", 
      executionHistory: [],
      triageResult: undefined,
      enhancedPrompt: undefined,
      scope: undefined,
      dataSources: undefined,
      searchResults: undefined,
      dataGaps: undefined,
      analysisResults: undefined,
      presentation: undefined,
      review: undefined,
    };

    const config = { recursionLimit: 50 };
    return await this.graph.invoke(initialState, config);
  }

  async *executeStream(userInput: string, userProfile?: any): AsyncGenerator<any> {
    const initialState = {
      userInput,
      userProfile,
      currentAgent: "triager",
      executionHistory: [],
      triageResult: undefined,
      enhancedPrompt: undefined,
      scope: undefined,
      dataSources: undefined,
      searchResults: undefined,
      dataGaps: undefined,
      analysisResults: undefined,
      presentation: undefined,
      review: undefined,
    };

    const config = { recursionLimit: 50 };
    
    for await (const step of await this.graph.stream(initialState, config)) {
      yield step;
    }
  }
}



// import { END, StateGraph } from "@langchain/langgraph";
// // import { dataAnalyzerAgent } from "./agents/data-analyzer";
// // import { dataPresenterAgent } from "./data-presenter";
// // import { dataSearcherAgent } from "./data-searcher";
// // import { dataSourceManagerAgent } from "./data-source-manager";
// // import { expertInputAgent } from "./expert-input";
// // import { leadManagerAgent } from "./lead-manager";
// // import { reviewerAgent } from "./reviewer";
// // import { userPersonaAgent } from "./user-persona";
// import { AgentState } from "./graph-state";
// import { promptEnhancerAgent } from "./prompt-enhancer";
// import { triagerAgent } from "./triager";

// export class AgentOrchestrator {
//   private graph: any;

//   constructor() {
//     this.buildGraph();
//   }

//   private buildGraph() {
//     const workflow = new StateGraph(AgentState);

//     // Add all agent nodes
//     // workflow.addNode("user_persona", userPersonaAgent);
//     // workflow.addNode("lead_manager", leadManagerAgent);
//     // workflow.addNode("data_source_manager", dataSourceManagerAgent);
//     // workflow.addNode("data_searcher", dataSearcherAgent);
//     // workflow.addNode("expert_input", expertInputAgent);
//     // workflow.addNode("data_analyzer", dataAnalyzerAgent);
//     // workflow.addNode("data_presenter", dataPresenterAgent);
//     // workflow.addNode("reviewer", reviewerAgent);
//     workflow.addNode("triager", triagerAgent);
//     workflow.addNode("prompt_enhancer", promptEnhancerAgent);

//     // Define the flow
//     workflow.setEntryPoint("triager");
    
//     workflow.addEdge("triager", "prompt_enhancer");
//     workflow.addEdge("prompt_enhancer", "lead_manager");
//     // workflow.addEdge("lead_manager", "data_source_manager");
//     // workflow.addEdge("data_source_manager", "data_searcher");
//     // workflow.addEdge("data_searcher", "expert_input");
//     // workflow.addEdge("expert_input", "data_analyzer");
//     // workflow.addEdge("data_analyzer", "data_presenter");
//     // workflow.addEdge("data_presenter", "reviewer");
    
//     // Add conditional edge for revisions
//     workflow.addConditionalEdges(
//       "reviewer",
//       (state: AgentState) => {
//         if (state.review?.quality_score && state.review.quality_score >= 0.8) {
//           return "end";
//         }
//         return "revise";
//       },
//       {
//         end: END,
//         revise: "data_analyzer",
//       }
//     );

//     this.graph = workflow.compile();
//   }

//   async execute(userInput: string, userProfile?: any): Promise<AgentState> {
//     const initialState: AgentState = {
//       userInput,
//       userProfile,
//       currentAgent: "user_persona",
//       executionHistory: []
//     };

//     const config = { recursionLimit: 50 };
//     return await this.graph.invoke(initialState, config);
//   }

//   // For streaming progress updates
//   async *executeStream(userInput: string, userProfile?: any): AsyncGenerator<AgentState> {
//     const initialState: AgentState = {
//       userInput,
//       userProfile,
//       currentAgent: "user_persona",
//       executionHistory: []
//     };

//     const config = { recursionLimit: 50 };
    
//     for await (const step of await this.graph.stream(initialState, config)) {
//       yield step;
//     }
//   }
// }
