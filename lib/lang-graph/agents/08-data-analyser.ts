import { AgentNode } from "../graph-state/graph-state";

export const dataAnalyzerAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    dataAnalyserResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "data_analyser",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
