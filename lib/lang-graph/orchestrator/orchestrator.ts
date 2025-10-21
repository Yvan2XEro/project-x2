import { END, StateGraph } from "@langchain/langgraph";
import { leadManagerAgent } from "../agents/03-lead-manager";
import { dataSourceManagerAgent } from "../agents/04-data-source-manager";
import { promptEnhancerAgent } from "../agents/tiager-prompt-enhancer";
import { AgentState } from "../graph-state/graph-state";

export class AgentOrchestrator {
  private graph: any;

  constructor() {
    this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(AgentState);

    workflow.addNode("prompt_enhancer", promptEnhancerAgent);
    workflow.addNode("lead_manager", leadManagerAgent);
    workflow.addNode("data_source_manager", dataSourceManagerAgent);
    // workflow.addNode("data_connector", dataConnectorAgent);
    // workflow.addNode("data_searcher", dataSearcherAgent);
    // workflow.addNode("expert_input", expertInputRequiredAgent);
    // workflow.addNode("data_analyzer", dataAnalyzerAgent);
    // workflow.addNode("data_presenter", dataPresenterAgent);
    // workflow.addNode("reviewer", reviewerAgent);

    workflow.setEntryPoint("prompt_enhancer");
    workflow.addEdge("prompt_enhancer", "lead_manager");
    // workflow.addEdge("lead_manager", END);
    workflow.addEdge("lead_manager", "data_source_manager");
    workflow.addEdge("data_source_manager", END);
    // workflow.addEdge("data_connector", END);
    // workflow.addEdge("data_connector", "data_searcher");
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
      currentAgent: "prompt_enhancer",
      executionHistory: [],
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

  async *executeStream(
    userInput: string,
    userProfile?: any
  ): AsyncGenerator<any> {
    const initialState = {
      userInput,
      userProfile,
      currentAgent: "prompt_enhancer",
      executionHistory: [],
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
