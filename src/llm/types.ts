// The conversation is kept in Anthropic Messages form; the OpenAI-compatible adapter
// converts to and from it at the edge.

export type ImageBlock = { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string } };
export type TextBlock = { type: "text"; text: string };
export type ThinkingBlock = { type: "thinking"; thinking: string; signature: string };
export type RedactedThinkingBlock = { type: "redacted_thinking"; data: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: Array<TextBlock | ImageBlock>; is_error?: boolean };

export type AssistantBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock;
export type UserBlock = TextBlock | ImageBlock | ToolResultBlock;

export type Message =
  | { role: "user"; content: UserBlock[] }
  | { role: "assistant"; content: AssistantBlock[] };

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type Protocol = "anthropic" | "openai";
export type Effort = "" | "low" | "medium" | "high";

export interface ProviderSettings {
  protocol: Protocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  /** Thinking effort hint; empty leaves the model's default. */
  effort?: Effort;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface CompletionRequest {
  system: string;
  messages: Message[];
  tools: ToolSpec[];
  signal?: AbortSignal;
}

export interface Completion {
  content: AssistantBlock[];
  stopReason: string;
  usage: Usage;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_progress"; id: string; bytes: number };

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message);
  }
}

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
