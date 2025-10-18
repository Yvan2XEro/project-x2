import { usedModel } from "@/lib/constants";
import { getUserProfile } from "@/utils/user-profile";
import { z } from "zod";
import { AgentNode } from "../graph-state/graph-state";

export const triagerAgent: AgentNode = async ({
  userInput,
}: {
  userInput: string;
}) => {
  const userProfile = await getUserProfile();
  const state = { userInput, userProfile: userProfile?.[0], executionHistory: [] };
  
  const model = usedModel;
  const schema = z.object({
    sector: z
      .string()
      .describe(
        "The business sector, e.g., Financial Services, Technology, Healthcare"
      ),
    function: z
      .string()
      .describe(
        "The business function, e.g., Market Analysis, Sales Strategy, Risk Assessment"
      ),
    confidence: z.number().describe("Confidence score from 0-1"),
  });
  const structuredModel = model.withStructuredOutput(schema);

  const result = await structuredModel.invoke(`
    Analyze the following user query and triage it into sector and function categories.
    
    User Query: ${state.userInput} 
    ${state.userProfile ? `User Role: ${state.userProfile.role}` : ""} 
    ${state.userProfile ? `User Company: ${state.userProfile.company_name}` : ""} 
    
    Return the most appropriate sector and function.
  `);

  return {
    triageResult: result,
    executionHistory: [
      ...state.executionHistory,
      {
        agent: "triager",
        timestamp: new Date(),
        status: "completed",
        output: result,
      },
    ],
  };
};
