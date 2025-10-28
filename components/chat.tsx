"use client";

import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAgentTimeline } from "@/hooks/use-agent-timeline";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useReferences } from "@/hooks/use-references";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { isTestEnvironment } from "@/lib/constants";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { getUserProfile } from "@/utils/user-profile";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { AgentTimeline } from "./agent-timeline";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { ReferencesSidebar } from "./references-sidebar";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { dataStream, setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const agentTimeline = useAgentTimeline();

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,

    transport: new DefaultChatTransport({
      // api: "/api/chat",
      // api: "/api/agents/structured_output",
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            messages: request.messages,
            action: "execute-full",
            userProfile: getUserProfile(),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const isGenerating = status === "submitted" || status === "streaming";

  const {
    references,
    highlightedMessageId,
    setHighlightedMessageId,
  } = useReferences(messages);

  const referenceMessageIds = useMemo(() => {
    return references.map((entry) => entry.messageId);
  }, [references]);

  const handleMessageHighlight = useCallback(
    (messageId: string) => {
      highlightSourceRef.current = "message";
      setHighlightedMessageId(messageId);
    },
    [setHighlightedMessageId],
  );

  const handleMessageClearHighlight = useCallback(
    (messageId: string) => {
      if (
        highlightSourceRef.current === "message" &&
        highlightedMessageId === messageId
      ) {
        highlightSourceRef.current = null;
        setHighlightedMessageId(null);
      }
    },
    [highlightedMessageId, setHighlightedMessageId],
  );

  const handleSidebarHighlightChange = useCallback(
    (messageId: string | null) => {
      highlightSourceRef.current = messageId ? "sidebar" : null;
      setHighlightedMessageId(messageId);
    },
    [setHighlightedMessageId],
  );

  useEffect(() => {
    if (status === "submitted") {
      setDataStream([]);
    }
  }, [status, setDataStream]);

  const showAgentTimeline =
    agentTimeline.length > 0 && (status === "submitted" || status === "streaming");

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const highlightSourceRef = useRef<"message" | "sidebar" | null>(null);

  useEffect(() => {
    for (const message of initialMessages) {
      processedMessageIdsRef.current.add(message.id);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (!isTestEnvironment || typeof window === "undefined") {
      return;
    }

    window.__PROJECT_X_CHAT_TEST__ = {
      appendMessage(message) {
        processedMessageIdsRef.current.add(message.id);
        setMessages((previous) => [...previous, message]);
      },
      setHighlight(messageId) {
        highlightSourceRef.current =
          typeof messageId === "string" ? "sidebar" : null;
        setHighlightedMessageId(messageId);
      },
    };

    return () => {
      delete window.__PROJECT_X_CHAT_TEST__;
    };
  }, [setMessages, setHighlightedMessageId]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  useEffect(() => {
    if (!Array.isArray(dataStream) || dataStream.length === 0) {
      return;
    }

    const pendingMessages: ChatMessage[] = [];

    for (const part of dataStream) {
      if (part.type !== "data-appendMessage") {
        continue;
      }

      try {
        const message = JSON.parse(part.data) as ChatMessage;

        if (!message || typeof message.id !== "string") {
          continue;
        }

        if (processedMessageIdsRef.current.has(message.id)) {
          continue;
        }

        processedMessageIdsRef.current.add(message.id);
        pendingMessages.push(message);
      } catch (error) {
        console.warn("Failed to parse appended message", error);
      }
    }

    if (pendingMessages.length === 0) {
      return;
    }

    setMessages((previous) => {
      if (pendingMessages.length === 0) {
        return previous;
      }

      const existingIds = new Set(previous.map((message) => message.id));
      const filtered = pendingMessages.filter((message) => {
        if (existingIds.has(message.id)) {
          return false;
        }
        existingIds.add(message.id);
        return true;
      });

      if (filtered.length === 0) {
        return previous;
      }

      return [...previous, ...filtered];
    });
  }, [dataStream, setMessages]);

  return (
    <>
      <div className="flex h-dvh min-w-0 bg-background">
        <div className="overscroll-behavior-contain flex min-w-0 flex-1 touch-pan-y flex-col">
          <ChatHeader
            chatId={id}
            isReadonly={isReadonly}
            selectedVisibilityType={initialVisibilityType}
          />

          <Messages
            chatId={id}
            highlightedMessageId={highlightedMessageId}
            isArtifactVisible={isArtifactVisible}
            isReadonly={isReadonly}
            messages={messages}
            onMessageClearHighlight={handleMessageClearHighlight}
            onMessageHighlight={handleMessageHighlight}
            referenceMessageIds={referenceMessageIds}
            regenerate={regenerate}
            selectedModelId={initialChatModel}
            setMessages={setMessages}
            status={status}
            votes={votes}
          />

          <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
            {!isReadonly && (
              <MultimodalInput
                attachments={attachments}
                chatId={id}
                input={input}
                messages={messages}
                onModelChange={setCurrentModelId}
                selectedModelId={currentModelId}
                selectedVisibilityType={visibilityType}
                sendMessage={sendMessage}
                setAttachments={setAttachments}
                setInput={setInput}
                setMessages={setMessages}
                status={status}
                stop={stop}
                usage={usage}
              />
            )}
          </div>

          {showAgentTimeline && (
            <div className="mx-auto w-full max-w-4xl px-2 pb-2 md:px-4">
              <AgentTimeline
                className="border-border/70 bg-background/80 shadow-lg backdrop-blur"
                timeline={agentTimeline}
              />
            </div>
          )}
        </div>
        <ReferencesSidebar
          entries={references}
          highlightedMessageId={highlightedMessageId}
          onHighlightChange={handleSidebarHighlightChange}
        />
      </div>
      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

declare global {
  interface Window {
    __PROJECT_X_CHAT_TEST__?: {
      appendMessage: (message: ChatMessage) => void;
      setHighlight: (messageId: string | null) => void;
    };
  }
}
