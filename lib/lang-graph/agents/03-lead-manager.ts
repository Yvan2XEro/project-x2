import { AgentNode } from "../graph-state/graph-state";

export const leadManagerAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  

  return {
    leadManagerResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "lead_manager",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
