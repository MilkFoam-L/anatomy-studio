import { ApiError } from "./types";

/** Longest silence (no bytes at all, not even pings) before a stream counts as stalled. */
const IDLE_MS = 600_000;

export interface SseEvent {
  event: string;
  data: string;
}

/** Yields server-sent events from a fetch response body. */
export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal, idleMs = IDLE_MS): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled = new Promise<never>((_, fail) => {
        timer = setTimeout(() => fail(new ApiError(`The stream stalled: no data for ${Math.round(idleMs / 1000)} s`, 0, true)), idleMs);
      });
      const { value, done } = await Promise.race([reader.read(), stalled]).finally(() => clearTimeout(timer));
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const raw = buffer.slice(0, at);
        buffer = buffer.slice(at).replace(/^\r?\n\r?\n/, "");
        const event = parseEvent(raw);
        if (event) yield event;
      }
    }
    const last = parseEvent(buffer);
    if (last) yield last;
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

export function parseEvent(raw: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
