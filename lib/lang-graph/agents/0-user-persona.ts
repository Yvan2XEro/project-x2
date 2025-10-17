import { AgentNode } from "../graph-state/graph-state";

export const userPersonaAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  return {
    userPersonaResult: userInput, //must be change
    executionHistory: [
      // ...state.executionHistory,
      {
        agent: "user_persona",
        timestamp: new Date(),
        status: "completed",
        output: userInput, //must be change
      },
    ],
  };
};
