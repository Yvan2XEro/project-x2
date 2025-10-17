import { AgentNode } from "../graph-state/graph-state";

export const expertInputRequiredAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    expertInputRequiredResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "expert_input_required",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
