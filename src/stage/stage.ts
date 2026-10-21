// The stage renders a figure page in an opaque-origin sandbox iframe with the agent
// injected, at the viewport size a check asks for, and talks to it over postMessage.
// It must stay on screen: browsers throttle animation frames in hidden cross-origin frames.
import { dirname, join } from "../runtime/paths";
import type { Vfs } from "../runtime/vfs";

export interface StageOptions {
  width: number;
  height: number;
  reduced?: boolean;
  theme?: "dark" | "light";
  noWebgl?: boolean;
  preload?: string;
}

type Listener = (frame: HTMLIFrameElement | null) => void;

const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline' data: https://fonts.googleapis.com; font-src data: blob: https://fonts.gstatic.com; img-src data: blob:; connect-src data: blob:; worker-src blob:; media-src data: blob:";

/** Inlines `<script src>` and stylesheet links that point at files in the workspace. */
export function inlineLocalAssets(html: string, pageKey: string, vfs: Vfs): string {
  const dir = dirname(`/${pageKey}`);
  const local = (ref: string) => {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) return null;
    const key = join(dir, ref.split(/[?#]/)[0]).replace(/^\//, "");
    return vfs.has(key) ? vfs.text(key) : null;
  };
  return html
    .replace(/<script\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (whole, before: string, _q, ref: string, after: string) => {
      const code = local(ref);
      return code === null ? whole : `<script${before}${after}>${code.replace(/<\/script/gi, "<\\/script")}</script>`;
    })
    .replace(/<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi, (whole) => {
      const href = whole.match(/\bhref=(["'])([^"']+)\1/i)?.[2];
      const css = href ? local(href) : null;
      return css === null ? whole : `<style>${css}</style>`;
    });
}

const HEAD = /<head(?=[\s>])[^>]*>/i;
const HTML = /<html(?=[\s>])[^>]*>/i;

function intoHead(html: string, head: string): string {
  if (HEAD.test(html)) return html.replace(HEAD, (tag) => `${tag}${head}`);
  if (HTML.test(html)) return html.replace(HTML, (tag) => `${tag}<head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

/** For previews: the figure runs its own scripts but cannot reach the network. */
export function withCsp(html: string): string {
  return intoHead(html, `<meta http-equiv="Content-Security-Policy" content="${CSP.replace(" 'unsafe-eval'", "")}">`);
}

export function injectAgent(html: string, agent: string, options: StageOptions): string {
  const config = { reduced: options.reduced, theme: options.theme, noWebgl: options.noWebgl };
  const head = [
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<script>window.__stageConfig=${JSON.stringify(config)};</script>`,
    `<script>${agent.replace(/<\/script/gi, "<\\/script")}</script>`,
    options.preload ? `<script>${options.preload.replace(/<\/script/gi, "<\\/script")}</script>` : "",
  ].join("");
  return intoHead(html, head);
}

export interface StageSize {
  width: number;
  height: number;
}

export class Stage {
  private frame: HTMLIFrameElement | null = null;
  private seq = 0;
  private host: HTMLElement | null = null;
  private fallback: HTMLElement | null = null;
  private readonly listeners = new Set<Listener>();
  /** The viewport of the page on show; null when the stage is empty. */
  size: StageSize | null = null;

  constructor(private readonly agent: string) {}

  /**
   * Where the UI shows the stage; without one a tiny corner box keeps it rendering.
   * `fit` is called synchronously whenever the page on show changes size, so the view
   * can scale it before the browser paints.
   */
  mount(host: HTMLElement | null, fit?: (size: StageSize | null) => void): void {
    this.host = host;
    this.fit = fit ?? null;
    for (const frame of this.shown) this.place(frame);
    this.fit?.(this.size);
  }

  private fit: ((size: StageSize | null) => void) | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.frame);
    return () => this.listeners.delete(listener);
  }

  /** Swaps the shown page for `frame` in one step: no blank or unscaled frame is painted. */
  private show(frame: HTMLIFrameElement, size: StageSize): void {
    for (const old of this.shown) if (old !== frame) old.remove();
    this.shown = [frame];
    frame.style.visibility = "";
    frame.style.zIndex = "1";
    this.size = size;
    this.fit?.(size);
  }

  private shown: HTMLIFrameElement[] = [];

  private place(frame: HTMLIFrameElement): void {
    if (this.host) {
      this.fallback?.remove();
      this.fallback = null;
      this.host.append(frame);
      return;
    }
    if (!this.fallback) {
      this.fallback = document.createElement("div");
      this.fallback.style.cssText = "position:fixed;right:0;bottom:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1";
      document.body.append(this.fallback);
    }
    this.fallback.append(frame);
  }

  async load(html: string, options: StageOptions): Promise<void> {
    // The previous page stays on show above the new one until the new one is ready.
    for (const old of this.shown) if (old !== this.frame) old.remove();
    this.shown = this.frame ? [this.frame] : [];
    const frame = document.createElement("iframe");
    const size = { width: options.width, height: options.height };
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", "Figure under test");
    frame.style.cssText = `position:absolute;left:0;top:0;width:${size.width}px;height:${size.height}px;border:0;background:#fff;display:block;z-index:0`;
    if (!this.shown.length) frame.style.visibility = "hidden";
    const ready = new Promise<void>((done, fail) => {
      const timer = setTimeout(() => {
        removeEventListener("message", listen);
        fail(new Error("The page did not finish loading within 15 s"));
      }, 15000);
      const listen = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.stage !== "ready") return;
        clearTimeout(timer);
        removeEventListener("message", listen);
        done();
      };
      addEventListener("message", listen);
    });
    frame.srcdoc = injectAgent(html, this.agent, options);
    this.frame = frame;
    this.shown.push(frame);
    this.place(frame);
    for (const listener of this.listeners) listener(frame);
    try {
      await ready;
    } finally {
      if (this.frame === frame) this.show(frame, size);
    }
  }

  call<T = unknown>(op: string, args: unknown[] = [], timeoutMs = 60000, signal?: AbortSignal): Promise<T> {
    const frame = this.frame;
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    if (!frame?.contentWindow) return Promise.reject(new Error("No page is loaded on the stage"));
    const id = ++this.seq;
    return new Promise<T>((done, fail) => {
      const cleanup = () => {
        clearTimeout(timer);
        removeEventListener("message", listen);
        signal?.removeEventListener("abort", abort);
      };
      const timer = setTimeout(() => {
        cleanup();
        fail(new Error(`The page did not answer ${op} within ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
      const abort = () => {
        cleanup();
        fail(new DOMException("Aborted", "AbortError"));
      };
      const listen = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.stage !== "reply" || event.data.id !== id) return;
        cleanup();
        if (event.data.ok) done(event.data.result as T);
        else fail(new Error(event.data.error));
      };
      addEventListener("message", listen);
      signal?.addEventListener("abort", abort, { once: true });
      frame.contentWindow!.postMessage({ stage: "call", id, op, args }, "*");
    });
  }

  clear(): void {
    for (const frame of this.shown) frame.remove();
    this.shown = [];
    this.frame?.remove();
    this.frame = null;
    this.size = null;
    this.fit?.(null);
    for (const listener of this.listeners) listener(null);
  }
}
