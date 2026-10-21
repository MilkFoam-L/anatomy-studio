import { readSse } from "./sse";
import { ApiError, emptyUsage, type AssistantBlock, type Completion, type CompletionRequest, type Message, type ProviderSettings, type StreamEvent } from "./types";

export function apiRoot(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

const isOfficial = (baseUrl: string) => /(^|\.)anthropic\.com$/.test(new URL(apiRoot(baseUrl)).hostname);

export function anthropicHeaders(settings: ProviderSettings): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-api-key": settings.apiKey };
  if (isOfficial(settings.baseUrl)) {
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else {
    // Relays usually allow only Authorization / x-api-key through CORS and fill in the
    // version header upstream themselves.
    headers.authorization = `Bearer ${settings.apiKey}`;
  }
  return headers;
}

/** Marks the system prompt and the newest message as cache breakpoints. */
export function withCache(messages: Message[]): Message[] {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  const content = last.content.map((block, index) => (index === last.content.length - 1 ? { ...block, cache_control: { type: "ephemeral" } } : block));
  return [...messages.slice(0, -1), { ...last, content } as Message];
}

export async function errorFrom(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  let message = text.slice(0, 300);
  try {
    const parsed = JSON.parse(text);
    message = parsed.error?.message ?? parsed.message ?? message;
  } catch {
    if (/<html/i.test(text)) message = `the endpoint returned an HTML error page (HTTP ${response.status})`;
  }
  const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
  return new ApiError(`HTTP ${response.status}: ${message}`, response.status, retryable);
}

/** fetch, with network failures (offline, DNS, CORS rejection) turned into a retryable ApiError. */
export async function post(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("网络请求失败：地址不可达，或接口不允许浏览器跨域访问（CORS）", 0, true);
  }
}

export function parseData(data: string): Record<string, any> | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

const FATAL_STREAM_ERRORS = /invalid_request|authentication|permission|not_found|billing/;

export async function completeAnthropic(settings: ProviderSettings, request: CompletionRequest, onEvent: (event: StreamEvent) => void): Promise<Completion> {
  const response = await post(`${apiRoot(settings.baseUrl)}/v1/messages`, {
    method: "POST",
    headers: anthropicHeaders(settings),
    signal: request.signal,
    body: JSON.stringify({
      model: settings.model,
      max_tokens: settings.maxTokens,
      stream: true,
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      ...(request.tools.length ? { tools: request.tools } : {}),
      messages: withCache(request.messages),
      ...(settings.effort ? { output_config: { effort: settings.effort } } : {}),
    }),
  });
  if (!response.ok) throw await errorFrom(response);
  if (!response.body || !/event-stream/.test(response.headers.get("content-type") ?? "")) {
    throw new ApiError(`Expected a stream but got ${response.headers.get("content-type") ?? "nothing"}`, response.status, true);
  }

  const blocks: Array<AssistantBlock & { json?: string }> = [];
  const usage = emptyUsage();
  let stopReason = "";
  for await (const { data } of readSse(response.body, request.signal)) {
    if (data === "[DONE]") break;
    const event = parseData(data);
    if (!event) continue;
    switch (event.type) {
      case "message_start": {
        const u = event.message?.usage ?? {};
        usage.input += u.input_tokens ?? 0;
        usage.cacheRead += u.cache_read_input_tokens ?? 0;
        usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
        usage.output += u.output_tokens ?? 0;
        break;
      }
      case "content_block_start": {
        const block = event.content_block ?? {};
        if (block.type === "tool_use") {
          blocks[event.index] = { type: "tool_use", id: block.id, name: block.name, input: {}, json: "" };
          onEvent({ type: "tool_start", id: block.id, name: block.name });
        } else if (block.type === "thinking") blocks[event.index] = { type: "thinking", thinking: block.thinking ?? "", signature: block.signature ?? "" };
        else if (block.type === "redacted_thinking") blocks[event.index] = { type: "redacted_thinking", data: block.data };
        else blocks[event.index] = { type: "text", text: block.text ?? "" };
        break;
      }
      case "content_block_delta": {
        const block = blocks[event.index];
        const delta = event.delta ?? {};
        if (delta.type === "text_delta" && block?.type === "text") {
          block.text += delta.text;
          onEvent({ type: "text", text: delta.text });
        } else if (delta.type === "thinking_delta" && block?.type === "thinking") {
          block.thinking += delta.thinking;
          onEvent({ type: "thinking", text: delta.thinking });
        } else if (delta.type === "signature_delta" && block?.type === "thinking") block.signature += delta.signature;
        else if (delta.type === "input_json_delta" && block?.type === "tool_use") {
          block.json = (block.json ?? "") + delta.partial_json;
          onEvent({ type: "tool_progress", id: block.id, bytes: block.json.length });
        }
        break;
      }
      case "message_delta":
        stopReason = event.delta?.stop_reason ?? stopReason;
        usage.output = Math.max(usage.output, event.usage?.output_tokens ?? 0);
        break;
      case "error":
        throw new ApiError(event.error?.message ?? "stream error", 500, !FATAL_STREAM_ERRORS.test(event.error?.type ?? ""));
    }
  }
  if (!stopReason) throw new ApiError("The stream ended before the reply finished", 0, true);

  const content: AssistantBlock[] = blocks.filter(Boolean).map((block) => {
    if (block.type !== "tool_use") return block;
    const { json, ...rest } = block;
    let input: Record<string, unknown> = {};
    try {
      input = json ? JSON.parse(json) : {};
    } catch {
      input = { __invalid_json: json };
    }
    return { ...rest, input };
  });
  return { content, stopReason, usage };
}
