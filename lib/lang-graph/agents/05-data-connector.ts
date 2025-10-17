import { AgentNode } from "../graph-state/graph-state";

export const dataConnectorAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    dataConnectorResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "data_connector",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
