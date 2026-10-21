import type { Message, ToolResultBlock } from "../llm/types";

const KEEP_IMAGE_TURNS = 2;
const KEEP_FULL_TEXT_TURNS = 8;
/** Compaction moves in steps of this many turns, so the prompt prefix (and its cache) stays stable in between. */
const STEP = 4;
const OLD_TEXT_LIMIT = 3000;

/** Index into `turns` before which content is compacted: a multiple of STEP, never the newest `keep`. */
function cutoff(turns: number[], keep: number): number {
  const drop = Math.floor(Math.max(0, turns.length - keep) / STEP) * STEP;
  return drop > 0 ? turns[drop] ?? Infinity : 0;
}

/**
 * What is sent to the model each turn: the full history, except screenshots and long tool
 * outputs from well back, which are shortened. The stored history is never changed.
 */
export function compactHistory(messages: Message[]): Message[] {
  const userTurns = messages.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0);
  const imageTurns = userTurns.filter((i) => messages[i].content.some((b) => b.type === "tool_result" && b.content.some((c) => c.type === "image")));
  const keepImagesFrom = cutoff(imageTurns, KEEP_IMAGE_TURNS);
  const keepTextFrom = cutoff(userTurns, KEEP_FULL_TEXT_TURNS);
  return messages.map((message, index) => {
    if (message.role !== "user" || (index >= keepImagesFrom && index >= keepTextFrom)) return message;
    const content = message.content.map((block) => {
      if (block.type !== "tool_result") return block;
      const parts = block.content.flatMap((part): ToolResultBlock["content"] => {
        if (part.type === "image") return index < keepImagesFrom ? [{ type: "text", text: "[older screenshot removed to save context]" }] : [part];
        if (index < keepTextFrom && part.text.length > OLD_TEXT_LIMIT) {
          return [{ type: "text", text: `${part.text.slice(0, OLD_TEXT_LIMIT)}\n… [older output shortened]` }];
        }
        return [part];
      });
      return { ...block, content: parts };
    });
    return { ...message, content };
  });
}
