// Injected at the top of every figure page the stage renders. It stands in for the
// Chrome DevTools Protocol that the skill's capture.mjs / drive.mjs use: it patches the
// page early (slow clock, WebGL buffers, reduced motion), collects console problems,
// and answers RPC calls from the studio (move, click, key, eval, screenshot…).
import { domToCanvas } from "modern-screenshot";

interface StageConfig {
  noWebgl?: boolean;
  reduced?: boolean;
  theme?: "dark" | "light";
}

type Box = { x: number; y: number; w: number; h: number };

const config: StageConfig = (window as unknown as { __stageConfig?: StageConfig }).__stageConfig ?? {};
const problems: string[] = [];
const text = (value: unknown) => (value instanceof Error ? `${value.name}: ${value.message}` : typeof value === "string" ? value : (() => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
})());

// --- early patches, before the page's own scripts run ---------------------------------

for (const level of ["error", "warn"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    problems.push(`console.${level === "warn" ? "warning" : "error"}: ${args.map(text).join(" ").slice(0, 600)}`);
    original(...args);
  };
}
addEventListener("error", (event) => problems.push(`exception: ${text(event.error ?? event.message)}`.slice(0, 600)));
addEventListener("unhandledrejection", (event) => problems.push(`exception: ${text(event.reason)}`.slice(0, 600)));

const speed = { value: 1 };
{
  const raf = window.requestAnimationFrame.bind(window);
  let real: number | null = null;
  let virtual = 0;
  window.requestAnimationFrame = (callback) =>
    raf((now) => {
      if (real === null) {
        real = now;
        virtual = now;
      }
      virtual += (now - real) * speed.value;
      real = now;
      callback(virtual);
    });
  const clock = performance.now.bind(performance);
  let base: number | null = null;
  let shown = 0;
  performance.now = () => {
    const now = clock();
    if (base === null) {
      base = now;
      shown = now;
    }
    shown += (now - base) * speed.value;
    base = now;
    return shown;
  };
}

{
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: Record<string, unknown>) {
    if (/webgl/.test(String(kind))) {
      if (config.noWebgl) return null;
      // Screenshots read the canvas back after the frame, which needs a kept buffer.
      return getContext.call(this, kind, { ...options, preserveDrawingBuffer: true });
    }
    return getContext.call(this, kind, options);
  } as typeof HTMLCanvasElement.prototype.getContext;
}

{
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const forced =
      /prefers-reduced-motion\s*:\s*reduce/.test(query) && config.reduced !== undefined ? config.reduced :
      /prefers-color-scheme\s*:\s*dark/.test(query) && config.theme ? config.theme === "dark" :
      /prefers-color-scheme\s*:\s*light/.test(query) && config.theme ? config.theme === "light" :
      undefined;
    const list = matchMedia(query);
    return forced === undefined ? list : Object.assign(Object.create(list), { matches: forced, media: query });
  };
}

{
  // Synthetic pointer ids have no active pointer, so real capture would throw.
  for (const name of ["setPointerCapture", "releasePointerCapture"] as const) {
    const original = Element.prototype[name];
    Element.prototype[name] = function (this: Element, id: number) {
      try {
        original.call(this, id);
      } catch {
        // Ignored on purpose: see above.
      }
    };
  }
}

{
  // modern-screenshot reads browser default styles from a hidden srcdoc iframe. Inside an
  // opaque-origin sandbox that nested frame gets an origin of its own and cannot be read,
  // so hand it an unstyled shadow root in this document instead: page CSS never reaches
  // into it and `all: initial` on the host cuts off inheritance, leaving UA defaults.
  let fake: { document: unknown; getComputedStyle: typeof getComputedStyle } | null = null;
  const defaults = () => {
    if (fake) return fake;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "all:initial;position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
    document.documentElement.append(host);
    const root = host.attachShadow({ mode: "open" });
    fake = {
      document: { createElement: document.createElement.bind(document), createElementNS: document.createElementNS.bind(document), body: root },
      getComputedStyle: window.getComputedStyle.bind(window),
    };
    return fake;
  };
  const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow")!;
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    ...descriptor,
    get(this: HTMLIFrameElement) {
      return this.id.startsWith("__SANDBOX__") ? defaults() : descriptor.get!.call(this);
    },
  });
}

// --- helpers --------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const frames = (count = 2) => new Promise<void>((done) => {
  const step = (left: number) => (left ? window.requestAnimationFrame(() => step(left - 1)) : done());
  step(count);
});

function target(selector: string | null | undefined, fallback = ".iso-plate"): Element {
  const el = document.querySelector(selector ?? fallback);
  if (selector != null && !el) throw new Error(`Drive target not found: ${selector}`);
  return el ?? document.body;
}

function boxOf(selector?: string | null): Box {
  const r = target(selector).getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function readout(selector?: string | null): string {
  if (selector == null) return document.querySelector("[data-readout]")?.textContent ?? "";
  const el = target(selector);
  const found = el.matches("[data-readout]") ? el : el.querySelector("[data-readout]") ?? el.closest(".iso-plate")?.querySelector("[data-readout]");
  return found?.textContent ?? "";
}

let mouse: [number, number] = [4, 4];
let hovered: Element | null = null;

function pointer(type: string, x: number, y: number, buttons = 0) {
  const el = document.elementFromPoint(x, y) ?? document.body;
  if (el !== hovered) {
    const init = { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true };
    if (hovered) {
      hovered.dispatchEvent(new PointerEvent("pointerout", init));
      hovered.dispatchEvent(new MouseEvent("mouseout", init));
      hovered.dispatchEvent(new PointerEvent("pointerleave", { ...init, bubbles: false }));
      hovered.dispatchEvent(new MouseEvent("mouseleave", { ...init, bubbles: false }));
    }
    el.dispatchEvent(new PointerEvent("pointerover", init));
    el.dispatchEvent(new MouseEvent("mouseover", init));
    el.dispatchEvent(new PointerEvent("pointerenter", { ...init, bubbles: false }));
    el.dispatchEvent(new MouseEvent("mouseenter", { ...init, bubbles: false }));
    hovered = el;
  }
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, buttons, button: type.endsWith("down") || type.endsWith("up") ? 0 : -1, pointerId: 1, pointerType: "mouse", isPrimary: true, view: window };
  el.dispatchEvent(new PointerEvent(`pointer${type}`, init));
  el.dispatchEvent(new MouseEvent(`mouse${type}`, { ...init, button: Math.max(0, init.button) }));
  return el;
}

async function glide(to: [number, number], steps: number, buttons = 0) {
  const from = mouse;
  for (let step = 1; step <= steps; step++) {
    pointer("move", from[0] + ((to[0] - from[0]) * step) / steps, from[1] + ((to[1] - from[1]) * step) / steps, buttons);
    await sleep(16);
  }
  mouse = to;
}

const pointIn = (selector: string | null, fx = 0.5, fy = 0.5): [number, number] => {
  const box = boxOf(selector);
  return [box.x + box.w * fx, box.y + box.h * fy];
};

const NAMED_CODES: Record<string, string> = { " ": "Space", "-": "Minus", "=": "Equal", ",": "Comma", ".": "Period", "/": "Slash", ";": "Semicolon", "'": "Quote", "[": "BracketLeft", "]": "BracketRight", "\\": "Backslash", "`": "Backquote" };

function press(key: string, selector?: string | null, code?: string) {
  const el = document.querySelector(selector ?? '[tabindex="0"]') as HTMLElement | null;
  el?.focus();
  const focused = (document.activeElement as HTMLElement | null) ?? document.body;
  const resolved = code ?? NAMED_CODES[key] ?? (/^[0-9]$/.test(key) ? `Digit${key}` : key.length === 1 ? `Key${key.toUpperCase()}` : key);
  const init = { key, code: resolved, bubbles: true, cancelable: true, composed: true };
  const down = focused.dispatchEvent(new KeyboardEvent("keydown", init));
  if (down && key.length === 1) focused.dispatchEvent(new KeyboardEvent("keypress", init));
  focused.dispatchEvent(new KeyboardEvent("keyup", init));
}

async function evaluate(source: string): Promise<unknown> {
  // Indirect eval runs in the page's global scope, like Runtime.evaluate.
  const value = (0, eval)(source);
  return await value;
}

async function shot(selector: string | null, scale = 1, region?: [number, number, number, number], rings?: Array<[number, number]>): Promise<string> {
  const el = target(selector) as HTMLElement;
  const box = el.getBoundingClientRect();
  const canvas = await domToCanvas(el, { scale, width: box.width, height: box.height, backgroundColor: getComputedStyle(document.body).backgroundColor || undefined });
  let out = canvas;
  if (region) {
    const [x, y, w, h] = region;
    out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(w * scale));
    out.height = Math.max(1, Math.round(h * scale));
    out.getContext("2d")!.drawImage(canvas, x * scale, y * scale, w * scale, h * scale, 0, 0, out.width, out.height);
  }
  if (rings?.length) {
    const ctx = out.getContext("2d")!;
    ctx.strokeStyle = "#ff0050";
    ctx.lineWidth = 1.5 * scale;
    for (const [x, y] of rings) {
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, 5 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return out.toDataURL("image/png");
}

async function turn(value: unknown, group?: string) {
  const api = (window as unknown as { __isoTurn?: { set: (v: unknown) => void } }).__isoTurn;
  if (typeof api?.set !== "function") throw new Error("turn action requires window.__isoTurn.set");
  api.set(group ? { [group]: value } : typeof value === "object" ? value : Number(value));
  await frames(2);
}

const OPS: Record<string, (...args: never[]) => unknown> = {
  box: (selector: string | null) => boxOf(selector),
  readout: (selector: string | null) => readout(selector),
  problems: () => problems.splice(0),
  sideways: () => document.documentElement.scrollWidth > innerWidth + 1,
  scrollThrough: async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 400) {
      scrollTo(0, y);
      await sleep(60);
    }
    scrollTo(0, 0);
  },
  scroll: (selector: string | null) => target(selector).scrollIntoView({ block: "center" }),
  move: (selector: string | null, fx: number, fy: number) => glide(pointIn(selector, fx, fy), 10),
  click: (selector: string | null, fx?: number, fy?: number) => {
    const to = pointIn(selector, fx ?? 0.5, fy ?? 0.5);
    pointer("move", ...to);
    pointer("down", ...to, 1);
    const el = pointer("up", ...to);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: to[0], clientY: to[1], view: window }));
    mouse = to;
  },
  drag: async (selector: string | null, fx0: number, fy0: number, fx1: number, fy1: number, steps?: number) => {
    const from = pointIn(selector, fx0, fy0);
    const to = pointIn(selector, fx1, fy1);
    pointer("move", ...from);
    pointer("down", ...from, 1);
    mouse = from;
    await glide(to, Math.max(1, steps ?? 20), 1);
    pointer("up", ...to);
  },
  key: (key: string, selector?: string | null, code?: string) => press(key, selector, code),
  eval: (source: string) => evaluate(source),
  until: async (source: string, timeout = 10000) => {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
      if (await evaluate(source)) return true;
      await sleep(25);
    }
    throw new Error(`until: timed out waiting for ${source}`);
  },
  slow: (factor: number) => {
    speed.value = Number(factor);
  },
  turn: (value: unknown, group?: string) => turn(value, group),
  shot: (selector: string | null, scale?: number, region?: [number, number, number, number], rings?: Array<[number, number]>) => shot(selector, scale ?? 1, region, rings),
  lines: (source: string, options: Record<string, unknown>) => (0, eval)(`(${source})`)({ ...options, show: false }),
};

addEventListener("message", async (event: MessageEvent) => {
  const data = event.data as { stage?: string; id?: number; op?: string; args?: unknown[] };
  if (event.source !== window.parent || data?.stage !== "call" || typeof data.id !== "number") return;
  const op = OPS[data.op ?? ""];
  try {
    if (!op) throw new Error(`Unknown stage op: ${data.op}`);
    const result = await (op as (...args: unknown[]) => unknown)(...(data.args ?? []));
    window.parent.postMessage({ stage: "reply", id: data.id, ok: true, result: JSON.parse(JSON.stringify(result ?? null)) }, "*");
  } catch (error) {
    window.parent.postMessage({ stage: "reply", id: data.id, ok: false, error: error instanceof Error && error.stack ? `${text(error)}\n${error.stack.split("\n").slice(1, 4).join("\n")}` : text(error) }, "*");
  }
});

const announce = () => window.parent.postMessage({ stage: "ready" }, "*");
if (document.readyState === "complete") announce();
else addEventListener("load", announce, { once: true });
