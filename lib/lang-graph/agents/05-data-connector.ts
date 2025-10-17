import { AgentNode } from "../graph-state/graph-state";

export const dataConnectorAgent: AgentNode = async (state) => {
  const sources = state.dataSources?.preferred_sources || [];

  const connectedData = await Promise.all(
    sources.map(async (source: any) => {
      try {
        const response = await fetch(source.url);
        const data = await response.json();
        return { source: source.name, data };
      } catch (err: any) {
        return { source: source.name, error: err.message };
      }
    })
  );

  console.log({connectedData})

  return {
    ...state,
    connectedData,
    executionHistory: [
      ...state.executionHistory,
      {
        agent: "data_connector",
        status: "completed",
        timestamp: new Date(),
        output: `Connected to ${connectedData.length} data sources.`,
      },
    ],
  };
};
