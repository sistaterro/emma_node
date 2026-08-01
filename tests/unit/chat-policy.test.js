import { describe, expect, it } from "vitest";

import {
  boundedContextChunks,
  detectQuestionLanguage,
  noInfoReply,
  positiveIntSetting,
} from "#src/chat-policy.js";

describe("chat policy", () => {
  it("keeps ordered whole chunks within the context budget", () => {
    const chunks = [
      { source: "a", text: "a".repeat(10) },
      { source: "b", text: "b".repeat(10) },
      { source: "c", text: "c".repeat(10) },
    ];

    expect(boundedContextChunks(chunks, 21).map((chunk) => chunk.source)).toEqual(["a", "b"]);
  });

  it.each([
    ["¿Qué dice el documento?", "es"],
    ["Wat staat er in het document?", "nl"],
    ["Was steht im Dokument?", "de"],
    ["Bonjour, que dit le document ?", "fr"],
    ["Cosa dice il documento?", "it"],
    ["O que diz o documento?", "pt"],
    ["What does the document say?", "en"],
  ])("detects the language of %s", (question, language) => {
    expect(detectQuestionLanguage(question)).toBe(language);
    expect(noInfoReply(question)).toMatch(/^\[NO INFO\]\n/);
  });

  it("falls back for invalid or non-positive integer settings", () => {
    expect(positiveIntSetting("invalid", 100)).toBe(100);
    expect(positiveIntSetting("0", 100)).toBe(100);
    expect(positiveIntSetting("250", 100)).toBe(250);
  });
});
