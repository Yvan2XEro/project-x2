import { AgentNode } from "../graph-state/graph-state";

export const reviewerAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    reviewerResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "reviewer",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
