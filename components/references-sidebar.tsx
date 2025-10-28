"use client";

import { useCallback } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReferenceGroup } from "@/hooks/use-references";

type ReferencesSidebarProps = {
  entries: ReferenceGroup[];
  highlightedMessageId: string | null;
  onHighlightChange: (messageId: string | null) => void;
};

export function ReferencesSidebar({
  entries,
  highlightedMessageId,
  onHighlightChange,
}: ReferencesSidebarProps) {
  if (!entries.length) {
    return null;
  }

  const handleToggle = useCallback(
    (messageId: string) => {
      const nextHighlight =
        highlightedMessageId === messageId ? null : messageId;
      onHighlightChange(nextHighlight);

      if (nextHighlight) {
        const target = document.querySelector<HTMLElement>(
          `[data-message-id="${nextHighlight}"]`,
        );

        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [highlightedMessageId, onHighlightChange],
  );

  const handleDirectHighlight = useCallback(
    (messageId: string) => {
      onHighlightChange(messageId);

      const target = document.querySelector<HTMLElement>(
        `[data-message-id="${messageId}"]`,
      );

      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [onHighlightChange],
  );

  return (
    <aside
      className="hidden w-80 shrink-0 border-l bg-background/95 backdrop-blur xl:flex xl:flex-col"
      data-testid="references-sidebar"
    >
      <div className="border-b px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          References
        </p>
        <p className="text-sm text-muted-foreground">
          Sources and planned exports
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 px-4 py-4">
          {entries.map((entry) => {
            const isActive = entry.messageId === highlightedMessageId;

            return (
              <section
                key={entry.messageId}
                className={cn(
                  "rounded-lg border border-transparent bg-card/40 p-3 transition-colors",
                  isActive && "border-primary bg-primary/10",
                  !isActive && "hover:bg-muted/50",
                )}
                data-active={isActive ? "true" : "false"}
                data-message-id={entry.messageId}
                data-testid={`references-group-${entry.messageId}`}
              >
                <button
                  className="w-full text-left text-sm font-semibold text-foreground"
                  onClick={() => handleToggle(entry.messageId)}
                  type="button"
                  data-testid={`references-group-button-${entry.messageId}`}
                >
                  {entry.summary}
                </button>

                {entry.bibliography.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Sources
                    </p>
                    <ol className="space-y-2 text-sm">
                      {entry.bibliography.map((citation) => (
                        <li key={citation.id}>
                          <a
                            className="flex items-start gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            data-testid={`reference-citation-${citation.id}`}
                            href={citation.url}
                            onClick={() => handleDirectHighlight(entry.messageId)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span className="mt-0.5 text-xs font-semibold text-foreground">
                              {citation.id}
                            </span>
                            <span className="flex flex-1 flex-col">
                              <span className="font-medium leading-snug">
                                {citation.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {citation.publisher} · {citation.trustLevel}
                              </span>
                            </span>
                            <ArrowUpRightIcon className="mt-0.5 size-3 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {entry.exports.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Exports
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {entry.exports.map((exportItem) => (
                        <Button
                          data-testid={`reference-export-${entry.messageId}-${exportItem.format}`}
                          disabled={exportItem.status !== "ready"}
                          key={`${entry.messageId}-${exportItem.format}`}
                          onClick={() => handleDirectHighlight(entry.messageId)}
                          size="sm"
                          variant="outline"
                        >
                          {exportItem.format.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
