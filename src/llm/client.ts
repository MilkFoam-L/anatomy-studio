import { anthropicHeaders, apiRoot, completeAnthropic, errorFrom, post } from "./anthropic";
import { completeOpenAi } from "./openai";
import { ApiError, type Completion, type CompletionRequest, type ProviderSettings, type StreamEvent } from "./types";

const RETRIES = 6;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done, fail) => {
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      fail(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/** One model turn, retried on rate limits, gateway timeouts and dropped streams. */
export async function complete(
  settings: ProviderSettings,
  request: CompletionRequest,
  onEvent: (event: StreamEvent) => void,
  onRetry?: (attempt: number, error: Error, waitMs: number) => void,
): Promise<Completion> {
  const call = settings.protocol === "openai" ? completeOpenAi : completeAnthropic;
  for (let attempt = 1; ; attempt++) {
    try {
      return await call(settings, request, onEvent);
    } catch (error) {
      if (isAbort(error) || request.signal?.aborted) throw error;
      const retryable = error instanceof ApiError && error.retryable;
      if (!retryable || attempt > RETRIES) throw error;
      const wait = Math.min(60000, 2000 * 2 ** (attempt - 1));
      onRetry?.(attempt, error as Error, wait);
      await sleep(wait, request.signal);
    }
  }
}

export async function listModels(settings: Pick<ProviderSettings, "baseUrl" | "apiKey" | "protocol">): Promise<string[]> {
  const headers = settings.protocol === "anthropic" ? anthropicHeaders({ ...settings, model: "", maxTokens: 0 }) : { authorization: `Bearer ${settings.apiKey}` };
  delete headers["content-type"];
  const response = await post(`${apiRoot(settings.baseUrl)}/v1/models`, { headers });
  if (!response.ok) throw await errorFrom(response);
  const body = await response.json();
  return (body.data ?? []).map((m: { id: string }) => m.id).filter(Boolean).sort();
}

/** A tiny request that proves the endpoint, key, model and CORS all work. */
export async function ping(settings: ProviderSettings): Promise<string> {
  const reply = await complete({ ...settings, maxTokens: 64 }, {
    system: "Reply with the single word: ok",
    messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
    tools: [],
  }, () => undefined);
  return reply.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim() || "(empty reply)";
}
