import { END, StateGraph, type CompiledStateGraph } from "@langchain/langgraph";
import { leadManagerAgent } from "../agents/03-lead-manager";
import { dataSourceManagerAgent } from "../agents/04-data-source-manager";
import { dataConnectorAgent } from "../agents/05-data-connector";
import { dataSearcherAgent } from "../agents/06-data-searcher";
import { expertInputRequiredAgent } from "../agents/07-expert-input-required";
import { dataAnalyzerAgent } from "../agents/08-data-analyser";
import { dataPresenterAgent } from "../agents/09-data-presenter";
import { reviewerAgent } from "../agents/10-reviewer";
import { renderPackagerAgent } from "../agents/11-render-packager";
import { promptEnhancerAgent } from "../agents/tiager-prompt-enhancer";
import { AgentState } from "../graph-state/graph-state";

export class AgentOrchestrator {
  private graph: unknown = null;

  constructor() {
    this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(AgentState)
      .addNode("prompt_enhancer", promptEnhancerAgent)
      .addNode("lead_manager", leadManagerAgent)
      .addNode("data_source_manager", dataSourceManagerAgent)
      .addNode("data_connector", dataConnectorAgent)
      .addNode("data_searcher", dataSearcherAgent)
      .addNode("expert_input", expertInputRequiredAgent)
      .addNode("data_analyzer", dataAnalyzerAgent)
      .addNode("data_presenter", dataPresenterAgent)
      .addNode("reviewer", reviewerAgent)
      .addNode("render_packager", renderPackagerAgent);

    workflow.setEntryPoint("prompt_enhancer");
    workflow.addEdge("prompt_enhancer", "lead_manager");
    workflow.addEdge("lead_manager", "data_source_manager");
    workflow.addEdge("data_source_manager", "data_connector");
    workflow.addEdge("data_connector", "data_searcher");
    workflow.addEdge("data_searcher", "expert_input");
    workflow.addEdge("expert_input", "data_analyzer");
    workflow.addEdge("data_analyzer", "data_presenter");
    workflow.addEdge("data_presenter", "reviewer");
    workflow.addEdge("reviewer", "render_packager");
    workflow.addEdge("render_packager", END);

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

  private ensureGraph(): CompiledStateGraph<any, any, string, any, any, any, any> {
    if (!this.graph) {
      throw new Error("Agent workflow graph is not initialized");
    }

    return this.graph as CompiledStateGraph<any, any, string, any, any, any, any>;
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
      dataConnections: undefined,
      searchResults: undefined,
      dataGaps: undefined,
      analysisResults: undefined,
      presentation: undefined,
      renderedDeliverable: undefined,
      review: undefined,
    };

    const config = { recursionLimit: 50 } as const;
    const graph = this.ensureGraph();
    return await graph.invoke(initialState, config);
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
      dataConnections: undefined,
      searchResults: undefined,
      dataGaps: undefined,
      analysisResults: undefined,
      presentation: undefined,
      renderedDeliverable: undefined,
      review: undefined,
    };

    const config = { recursionLimit: 50, streamMode: "values" as const };
    const graph = this.ensureGraph();

    for await (const step of await graph.stream(initialState, config)) {
      yield step;
    }
  }
}
