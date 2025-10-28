import assert from "node:assert/strict";
import { test } from "node:test";

import type { DBMessage } from "@/lib/db/schema";
import { convertToUIMessages } from "@/lib/utils";

function createDbMessage(parts: unknown, id: string): DBMessage {
  return {
    id,
    chatId: "chat-id",
    role: "user",
    parts,
    attachments: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  } as DBMessage;
}

test("parses serialized message parts into UI parts", () => {
  const serializedParts = JSON.stringify([
    { type: "text", text: "Serialized message" },
  ]);

  const [message] = convertToUIMessages([
    createDbMessage(serializedParts, "message-1"),
  ]);

  assert.deepStrictEqual(message.parts, [
    { type: "text", text: "Serialized message" },
  ]);
});

test("falls back to a single text part when parsing fails", () => {
  const [message] = convertToUIMessages([
    createDbMessage("non-json payload", "message-2"),
  ]);

  assert.deepStrictEqual(message.parts, [
    { type: "text", text: "non-json payload" },
  ]);
});
