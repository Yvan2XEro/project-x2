import { AgentNode } from "../graph-state/graph-state";

export const dataPresenterAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    dataPresenterResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "data_presenter",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
