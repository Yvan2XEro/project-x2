import type { DBMessage, Document } from '@/lib/db/schema';
import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

type TextUIPart = Extract<
  UIMessagePart<CustomUIDataTypes, ChatTools>,
  { type: 'text' }
>;

type FileUIPart = Extract<
  UIMessagePart<CustomUIDataTypes, ChatTools>,
  { type: 'file' }
>;

export function isTextUIPart(
  part: UIMessagePart<CustomUIDataTypes, ChatTools>,
): part is TextUIPart {
  return part.type === 'text';
}

export function isFileUIPart(
  part: UIMessagePart<CustomUIDataTypes, ChatTools>,
): part is FileUIPart {
  return part.type === 'file';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

function toFallbackText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function normalizeMessageParts(
  parts: DBMessage["parts"],
): UIMessagePart<CustomUIDataTypes, ChatTools>[] {
  if (Array.isArray(parts)) {
    return parts as UIMessagePart<CustomUIDataTypes, ChatTools>[];
  }

  if (typeof parts === "string") {
    const trimmedParts = parts.trim();

    if (trimmedParts.length > 0) {
      try {
        const parsed = JSON.parse(trimmedParts);

        if (Array.isArray(parsed)) {
          return parsed as UIMessagePart<CustomUIDataTypes, ChatTools>[];
        }

        if (parsed && typeof parsed === "object" && "type" in parsed) {
          return [
            parsed as UIMessagePart<CustomUIDataTypes, ChatTools>,
          ];
        }
      } catch {
        // Fall through to fallback below when JSON parsing fails.
      }
    }

    return [
      {
        type: "text",
        text: toFallbackText(parts),
      } satisfies TextUIPart,
    ];
  }

  if (parts && typeof parts === "object") {
    if (
      "type" in parts &&
      typeof (parts as { type: unknown }).type === "string"
    ) {
      return [parts as UIMessagePart<CustomUIDataTypes, ChatTools>];
    }

    return [
      {
        type: "text",
        text: toFallbackText(parts),
      } satisfies TextUIPart,
    ];
  }

  return [
    {
      type: "text",
      text: toFallbackText(parts),
    } satisfies TextUIPart,
  ];
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: normalizeMessageParts(message.parts),
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('');
}
