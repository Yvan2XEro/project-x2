import { useMemo } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import type { AgentTimelineStep } from "@/lib/types";

export function useAgentTimeline(): AgentTimelineStep[] {
  const { dataStream } = useDataStream();

  return useMemo(() => {
    const timelineEvents = dataStream
      .filter((part) => part.type === "data-agentTimeline")
      .map((part) => part.data as AgentTimelineStep[])
      .filter((timeline) => Array.isArray(timeline));

    if (timelineEvents.length === 0) {
      return [];
    }

    return timelineEvents.at(-1) ?? [];
  }, [dataStream]);
}
