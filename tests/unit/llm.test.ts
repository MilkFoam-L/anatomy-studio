import { describe, expect, it } from "vitest";
import { compactHistory } from "../../src/agent/history";
import { apiRoot, withCache } from "../../src/llm/anthropic";
import { toChatMessages } from "../../src/llm/openai";
import { parseEvent, readSse } from "../../src/llm/sse";
import type { Message } from "../../src/llm/types";

const image = { type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: "AAAA" } };
const toolTurn = (id: string, withImage: boolean): Message[] => [
  { role: "assistant", content: [{ type: "tool_use", id, name: "run", input: { command: "node x.mjs" } }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: "ok" }, ...(withImage ? [image] : [])] }] },
];

describe("sse", () => {
  it("parses event and multi-line data", () => {
    expect(parseEvent("event: ping\ndata: {\"a\":1}\ndata: 2")).toEqual({ event: "ping", data: "{\"a\":1}\n2" });
  });

  it("streams events split across chunks", async () => {
    const chunks = ["event: a\ndata: 1\n", "\nevent: b\nda", "ta: 2\n\n"];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });
    const out = [];
    for await (const e of readSse(body)) out.push(e);
    expect(out).toEqual([{ event: "a", data: "1" }, { event: "b", data: "2" }]);
  });
});

describe("providers", () => {
  it("normalises the base URL", () => {
    expect(apiRoot("https://relay.example/v1/")).toBe("https://relay.example");
  });

  it("marks only the newest message as a cache breakpoint", () => {
    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "a" }] }, ...toolTurn("t1", false)];
    const out = withCache(messages) as unknown as Array<{ content: Array<Record<string, unknown>> }>;
    expect(out[2].content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(out[0].content[0].cache_control).toBeUndefined();
  });

  it("converts tool turns to chat completions with images as a following user turn", () => {
    const out = toChatMessages("sys", toolTurn("t1", true));
    expect(out[0]).toEqual({ role: "system", content: "sys" });
    expect(out[1]).toMatchObject({ role: "assistant", tool_calls: [{ id: "t1", function: { name: "run" } }] });
    expect(out[2]).toEqual({ role: "tool", tool_call_id: "t1", content: "ok" });
    expect(out[3]).toMatchObject({ role: "user", content: [{ type: "text" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] });
  });
});

describe("compactHistory", () => {
  const imagesIn = (m: Message) => (m.role === "user" ? m.content.flatMap((b) => (b.type === "tool_result" ? b.content.filter((c) => c.type === "image") : [])).length : 0);
  const withShots = (n: number): Message[] => [{ role: "user", content: [{ type: "text", text: "go" }] }, ...Array.from({ length: n }, (_, i) => toolTurn(String(i), true)).flat()];

  it("keeps every screenshot until a whole step of old ones can go", () => {
    const messages = withShots(5);
    expect(compactHistory(messages)).toEqual(messages);
  });

  it("drops old screenshots four at a time and leaves the stored history alone", () => {
    const messages = withShots(7);
    const userImages = (list: Message[]) => list.filter((m) => m.role === "user").slice(1).map(imagesIn);
    expect(userImages(compactHistory(messages))).toEqual([0, 0, 0, 0, 1, 1, 1]);
    expect(userImages(messages)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("gives the same prefix on consecutive turns between steps", () => {
    const a = compactHistory(withShots(7));
    const b = compactHistory(withShots(8));
    expect(b.slice(0, a.length)).toEqual(a);
  });
});
