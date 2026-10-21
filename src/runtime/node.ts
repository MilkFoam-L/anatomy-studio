import type { RunResult } from "./node-worker";
import type { Vfs } from "./vfs";

// The host page lives in an opaque-origin sandbox iframe; it starts a fresh worker for
// every run so module state never leaks between runs, and it can be killed on timeout.
const HOST = `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'">
<script>
let worker = null;
addEventListener("message", (event) => {
  if (event.source !== parent) return;
  const data = event.data;
  if (data.type === "kill") { if (worker) worker.terminate(); worker = null; return; }
  if (data.type !== "run") return;
  if (worker) worker.terminate();
  const url = URL.createObjectURL(new Blob([data.code], { type: "text/javascript" }));
  worker = new Worker(url);
  worker.onmessage = (message) => { parent.postMessage({ id: data.id, result: message.data }, "*"); worker.terminate(); worker = null; URL.revokeObjectURL(url); };
  worker.onerror = (error) => { parent.postMessage({ id: data.id, error: error.message || "worker failed" }, "*"); };
  worker.postMessage(data.payload);
});
parent.postMessage({ type: "host-ready" }, "*");
</script>`;

export interface NodeRun {
  exitCode: number;
  output: string;
  timedOut: boolean;
  written: string[];
}

export class NodeRuntime {
  private frame: HTMLIFrameElement | null = null;
  private ready: Promise<void> | null = null;
  private seq = 0;

  constructor(private readonly workerCode: string) {}

  private host(): Promise<void> {
    if (this.ready) return this.ready;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;width:1px;height:1px;left:0;top:0;border:0;opacity:0;pointer-events:none";
    frame.srcdoc = HOST;
    this.frame = frame;
    this.ready = new Promise<void>((done, fail) => {
      const timer = setTimeout(() => {
        removeEventListener("message", listen);
        frame.remove();
        this.frame = null;
        this.ready = null;
        fail(new Error("Node runtime host did not start"));
      }, 10000);
      const listen = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.type !== "host-ready") return;
        clearTimeout(timer);
        removeEventListener("message", listen);
        done();
      };
      addEventListener("message", listen);
    });
    document.body.append(frame);
    return this.ready;
  }

  async run(vfs: Vfs, cwd: string, argv: string[], timeoutMs: number, signal?: AbortSignal): Promise<NodeRun> {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await this.host();
    const frame = this.frame!;
    const id = ++this.seq;
    const payload = { type: "run", files: vfs.textFiles(), cwd, argv };
    const reply = await new Promise<{ result?: RunResult; error?: string; timedOut?: boolean }>((done) => {
      const stop = (value: { error?: string; timedOut?: boolean }) => {
        frame.contentWindow?.postMessage({ type: "kill" }, "*");
        cleanup();
        done(value);
      };
      const timer = setTimeout(() => stop({ timedOut: true }), timeoutMs);
      const abort = () => stop({ error: "aborted" });
      const listen = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.id !== id) return;
        cleanup();
        done(event.data);
      };
      const cleanup = () => {
        clearTimeout(timer);
        removeEventListener("message", listen);
        signal?.removeEventListener("abort", abort);
      };
      addEventListener("message", listen);
      signal?.addEventListener("abort", abort, { once: true });
      frame.contentWindow!.postMessage({ type: "run", id, code: this.workerCode, payload }, "*");
    });
    if (reply.timedOut) return { exitCode: 124, output: `Timed out after ${Math.round(timeoutMs / 1000)} s and was stopped.`, timedOut: true, written: [] };
    if (reply.error === "aborted") throw new DOMException("Aborted", "AbortError");
    if (!reply.result) return { exitCode: 1, output: reply.error ?? "Node runtime failed", timedOut: false, written: [] };
    const { result } = reply;
    for (const key of result.removed) vfs.remove(key);
    for (const [key, data] of Object.entries(result.written)) vfs.write(key, data);
    return { exitCode: result.exitCode, output: result.output, timedOut: false, written: Object.keys(result.written) };
  }

  dispose(): void {
    this.frame?.remove();
    this.frame = null;
    this.ready = null;
  }
}
