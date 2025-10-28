"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage, CustomUIDataTypes } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";

export type ReferenceGroup = {
  messageId: string;
  summary: string;
  anchors: CustomUIDataTypes["references"]["anchors"];
  bibliography: CustomUIDataTypes["references"]["bibliography"];
  exports: CustomUIDataTypes["references"]["exports"];
};

type ReferencesPart = {
  type: "data-references";
  data: CustomUIDataTypes["references"];
};

function isReferencesPart(part: ChatMessage["parts"][number]): part is ReferencesPart {
  return part?.type === "data-references";
}

export function useReferences(messages: ChatMessage[]) {
  const references = useMemo<ReferenceGroup[]>(() => {
    return messages
      .filter((message) => message.role === "assistant")
      .map((message) => {
        const referencesPart = message.parts.find(isReferencesPart);

        if (!referencesPart) {
          return null;
        }

        const rawText = getTextFromMessage(message).trim();
        const summary = rawText
          ? rawText.length > 160
            ? `${rawText.slice(0, 160).trimEnd()}…`
            : rawText
          : "Assistant response";

        return {
          messageId: message.id,
          summary,
          anchors: referencesPart.data.anchors,
          bibliography: referencesPart.data.bibliography,
          exports: referencesPart.data.exports,
        } satisfies ReferenceGroup;
      })
      .filter((group): group is ReferenceGroup => group !== null);
  }, [messages]);

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedMessageId) {
      return;
    }

    const stillExists = references.some(
      (group) => group.messageId === highlightedMessageId,
    );

    if (!stillExists) {
      setHighlightedMessageId(null);
    }
  }, [highlightedMessageId, references]);

  const handleHighlightChange = useCallback((messageId: string | null) => {
    setHighlightedMessageId(messageId);
  }, []);

  return {
    references,
    highlightedMessageId,
    setHighlightedMessageId: handleHighlightChange,
  };
}
