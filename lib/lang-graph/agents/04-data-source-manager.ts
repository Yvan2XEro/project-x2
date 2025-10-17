import { AgentNode } from "../graph-state/graph-state";

export const dataSourceManagerAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    dataSourceManagerResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "data_source_manager",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
