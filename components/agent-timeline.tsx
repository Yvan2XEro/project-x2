"use client";

import { formatDistanceToNow } from "date-fns";
import { memo } from "react";
import { useAgentTimeline } from "@/hooks/use-agent-timeline";
import type { AgentTimelineStep } from "@/lib/types";
import { cn } from "@/lib/utils";

function getStatusBadgeClasses(status: "started" | "completed" | "error") {
  if (status === "completed") {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (status === "error") {
    return "text-red-600 dark:text-red-400";
  }

  return "text-amber-600 dark:text-amber-400";
}

type AgentTimelineProps = {
  timeline?: AgentTimelineStep[];
  className?: string;
};

export const AgentTimeline = memo(function AgentTimeline({
  timeline: providedTimeline,
  className,
}: AgentTimelineProps) {
  const timeline = providedTimeline ?? useAgentTimeline();

  if (!timeline.length) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border/60 bg-background/70 p-4 text-sm shadow-md backdrop-blur-sm max-h-52 overflow-y-auto",
        className
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <p className="font-medium text-foreground">Agent thinking</p>
        <p className="text-muted-foreground text-xs">
          {timeline.length} step{timeline.length === 1 ? "" : "s"}
        </p>
      </header>

      <ol className="space-y-3">
        {timeline.map((step: AgentTimelineStep, index) => {
          let timestampLabel: string | undefined;
          if (step.timestamp) {
            const timestampDate = new Date(step.timestamp);
            if (!Number.isNaN(timestampDate.getTime())) {
              timestampLabel = formatDistanceToNow(timestampDate, {
                addSuffix: true,
              });
            }
          }

          return (
            <li
              className="rounded-md border border-border/60 bg-background/60 p-3"
              key={`${step.agent}-${index}-${step.status}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="text-muted-foreground text-xs">{step.agent}</p>
                </div>

                <div className="text-right text-xs">
                  <p className={getStatusBadgeClasses(step.status)}>
                    {step.status}
                  </p>
                  {timestampLabel && (
                    <p className="text-muted-foreground">{timestampLabel}</p>
                  )}
                </div>
              </div>

              {step.summary && (
                <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
                  {step.summary}
                </p>
              )}

              {step.details && (
                <details className="group mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-primary outline-none transition-colors group-hover:text-primary/80">
                    Details
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                    {step.details}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
});
