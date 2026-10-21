import { apiRoot, errorFrom, parseData, post } from "./anthropic";
import { readSse } from "./sse";
import { ApiError, emptyUsage, type AssistantBlock, type Completion, type CompletionRequest, type Message, type ProviderSettings, type StreamEvent, type ToolSpec } from "./types";

type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type ChatMessage =
  | { role: "system" | "user"; content: string | ChatPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
  | { role: "tool"; tool_call_id: string; content: string };

/** Anthropic-form history → chat completions messages. Images in tool results follow as a user turn. */
export function toChatMessages(system: string, messages: Message[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "assistant") {
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const calls = message.content.filter((b) => b.type === "tool_use");
      out.push({
        role: "assistant",
        content: text || null,
        ...(calls.length ? { tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.input) } })) } : {}),
      });
      continue;
    }
    const images: ChatPart[] = [];
    const parts: ChatPart[] = [];
    for (const block of message.content) {
      if (block.type === "tool_result") {
        const text = block.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
        out.push({ role: "tool", tool_call_id: block.tool_use_id, content: (block.is_error ? "[error] " : "") + text });
        for (const c of block.content) if (c.type === "image") images.push({ type: "image_url", image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } });
      } else if (block.type === "text") parts.push({ type: "text", text: block.text });
      else parts.push({ type: "image_url", image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } });
    }
    if (images.length) out.push({ role: "user", content: [{ type: "text", text: "Screenshots from the tool results above:" }, ...images] });
    if (parts.length) out.push({ role: "user", content: parts });
  }
  return out;
}

const toFunctions = (tools: ToolSpec[]) => tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }));

export async function completeOpenAi(settings: ProviderSettings, request: CompletionRequest, onEvent: (event: StreamEvent) => void): Promise<Completion> {
  const response = await post(`${apiRoot(settings.baseUrl)}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${settings.apiKey}` },
    signal: request.signal,
    body: JSON.stringify({
      model: settings.model,
      max_tokens: settings.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      ...(request.tools.length ? { tools: toFunctions(request.tools) } : {}),
      messages: toChatMessages(request.system, request.messages),
      ...(settings.effort ? { reasoning_effort: settings.effort } : {}),
    }),
  });
  if (!response.ok) throw await errorFrom(response);
  if (!response.body) throw new ApiError("Empty response", response.status, true);

  let text = "";
  const calls: Array<{ id: string; name: string; args: string }> = [];
  const usage = emptyUsage();
  let stopReason = "";
  for await (const { data } of readSse(response.body, request.signal)) {
    if (data === "[DONE]") break;
    const chunk = parseData(data);
    if (!chunk) continue;
    if (chunk.error) throw new ApiError(chunk.error.message ?? "stream error", 500, true);
    if (chunk.usage) {
      usage.input = chunk.usage.prompt_tokens ?? usage.input;
      usage.output = chunk.usage.completion_tokens ?? usage.output;
      usage.cacheRead = chunk.usage.prompt_tokens_details?.cached_tokens ?? usage.cacheRead;
    }
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta ?? {};
    if (delta.content) {
      text += delta.content;
      onEvent({ type: "text", text: delta.content });
    }
    if (delta.reasoning_content) onEvent({ type: "thinking", text: delta.reasoning_content });
    for (const call of delta.tool_calls ?? []) {
      const slot = (calls[call.index ?? 0] ??= { id: "", name: "", args: "" });
      if (call.id) slot.id = call.id;
      if (call.function?.name) {
        slot.name += call.function.name;
        onEvent({ type: "tool_start", id: slot.id, name: slot.name });
      }
      if (call.function?.arguments) {
        slot.args += call.function.arguments;
        onEvent({ type: "tool_progress", id: slot.id, bytes: slot.args.length });
      }
    }
    if (choice.finish_reason) stopReason = choice.finish_reason;
  }
  if (!stopReason) throw new ApiError("The stream ended before the reply finished", 0, true);

  const content: AssistantBlock[] = [];
  if (text) content.push({ type: "text", text });
  calls.filter(Boolean).forEach((call, index) => {
    let input: Record<string, unknown> = {};
    try {
      input = call.args ? JSON.parse(call.args) : {};
    } catch {
      input = { __invalid_json: call.args };
    }
    content.push({ type: "tool_use", id: call.id || `call_${Date.now()}_${index}`, name: call.name, input });
  });
  const mapped = stopReason === "tool_calls" ? "tool_use" : stopReason === "length" ? "max_tokens" : stopReason === "stop" ? "end_turn" : stopReason;
  return { content, stopReason: mapped, usage };
}
