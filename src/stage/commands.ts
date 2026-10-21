// Browser versions of the skill's Chrome-based checks, with the same command lines:
//   node scripts/capture.mjs page.html --out shots/a.png --hover 0.7,0.5 --zoom 200,80,220,170
//   node scripts/drive.mjs page.html '[["wait",1500],["move",null,0.7,0.4],["shot","shots/b.png"]]'
//   node scripts/lines.mjs page.html --out shots/lines.png
import { dataUrlToBytes, tile } from "../lib/images";
import type { CommandResult, RunContext } from "../runtime/context";
import { extname } from "../runtime/paths";
import { inlineLocalAssets, type StageOptions } from "./stage";

type Region = [number, number, number, number];
type Box = { x: number; y: number; w: number; h: number };
type LineProblem = { what: string; end: string; mark: boolean; gap: number | null; at: [number, number]; length: number; d: string; opacity: number };
type LineResult = { ends: number; lines: number; problems: LineProblem[] };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done, fail) => {
    if (signal?.aborted) return fail(new Error("aborted"));
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      fail(new Error("aborted"));
    }, { once: true });
  });

function pageHtml(ctx: RunContext, target: string): { html: string; key: string } {
  if (/^https?:/.test(target)) throw new Error("Only pages in the workspace can be checked here (no URLs)");
  const key = ctx.vfs.key(target, ctx.cwd);
  if (!ctx.vfs.has(key)) throw new Error(`No such page: ${target}`);
  const source = ctx.vfs.text(key);
  const html = extname(key) === ".svg" ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${source}</body></html>` : source;
  return { html: inlineLocalAssets(html, key, ctx.vfs), key };
}

function savePng(ctx: RunContext, out: string, dataUrl: string, images: string[]): string {
  const key = ctx.vfs.key(out, ctx.cwd);
  ctx.vfs.write(key, dataUrlToBytes(dataUrl));
  images.push(key);
  return key;
}

async function loadPage(ctx: RunContext, target: string, options: StageOptions): Promise<void> {
  const { html } = pageHtml(ctx, target);
  await ctx.stage.load(html, options);
}

/** Stage calls that give up as soon as the run is stopped. */
const staged = (ctx: RunContext) => ({
  call: <T = unknown>(op: string, args: unknown[] = [], timeoutMs?: number) => ctx.stage.call<T>(op, args, timeoutMs, ctx.signal),
});

const problemsText = (problems: string[]) => (problems.length ? problems.join("\n") : "console: clean");

// --- capture.mjs ----------------------------------------------------------------------

export async function capture(args: string[], ctx: RunContext): Promise<CommandResult> {
  const o = { width: 1440, height: 1000, scale: 2, wait: 2500, zoomScale: 4, times: [] as number[], out: "capture.png" } as {
    width: number; height: number; scale: number; wait: number; zoomScale: number; times: number[]; out: string;
    select?: string; zoom?: Region; hover?: [number, number]; keys?: string[]; reduced?: boolean; theme?: "dark" | "light";
  };
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = () => args[++i] ?? "";
    if (arg === "--out") o.out = next();
    else if (arg === "--width") o.width = Number(next());
    else if (arg === "--height") o.height = Number(next());
    else if (arg === "--scale") o.scale = Number(next());
    else if (arg === "--wait") o.wait = Number(next());
    else if (arg === "--select") o.select = next();
    else if (arg === "--zoom") o.zoom = next().split(",").map(Number) as Region;
    else if (arg === "--zoom-scale") o.zoomScale = Number(next());
    else if (arg === "--hover") o.hover = next().split(",").map(Number) as [number, number];
    else if (arg === "--key") o.keys = next().split(",");
    else if (arg === "--times") o.times = next().split(",").map(Number);
    else if (arg === "--reduced") o.reduced = true;
    else if (arg === "--theme") o.theme = next() as "dark" | "light";
    else rest.push(arg);
  }
  if (!rest[0]) return { exitCode: 1, output: "usage: node scripts/capture.mjs <page.html> [--out a.png] [--width] [--hover fx,fy] [--zoom x,y,w,h] [--key k] [--times ms] [--reduced]", images: [] };
  const images: string[] = [];
  const stage = staged(ctx);
  await loadPage(ctx, rest[0], { width: o.width, height: o.height, reduced: o.reduced, theme: o.theme });
  await stage.call("scrollThrough");
  await sleep(o.wait, ctx.signal);
  const select = o.select ?? null;
  if (o.hover) {
    await stage.call("move", [select, o.hover[0], o.hover[1]]);
    await sleep(400, ctx.signal);
  }
  for (const key of o.keys ?? []) {
    if (key === "Tab") continue;
    await stage.call("key", [key === "Comma" ? "," : key]);
    await sleep(120, ctx.signal);
  }
  const box = await stage.call<Box>("box", [select]);
  const take = () => stage.call<string>("shot", o.zoom ? [select, o.zoomScale, o.zoom] : [select, o.scale]);
  savePng(ctx, o.out, await take(), images);
  const readouts: string[] = [];
  const start = performance.now();
  for (const delay of [...o.times].sort((a, b) => a - b)) {
    await sleep(Math.max(0, delay - (performance.now() - start)), ctx.signal);
    const name = o.out.replace(/\.png$/, `-${delay}.png`);
    savePng(ctx, name, await take(), images);
    readouts.push(`${delay}ms "${await stage.call<string>("readout", [select])}"`);
  }
  const readout = await stage.call<string>("readout", [select]);
  const sideways = await stage.call<boolean>("sideways");
  const problems = await stage.call<string[]>("problems");
  const lines = [
    `saved ${o.out}`,
    `clip ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)} · readout "${readout}" · scrolls sideways: ${sideways ? "YES" : "no"}`,
    ...(readouts.length ? [`readout over time: ${readouts.join(" · ")}`] : []),
    problemsText(problems),
  ];
  return { exitCode: 0, output: lines.join("\n"), images };
}

// --- drive.mjs ------------------------------------------------------------------------

type Action = [string, ...unknown[]];

function lineEndsSource(ctx: RunContext): string {
  const text = ctx.vfs.text("scripts/line-ends.mjs");
  const at = text.indexOf("export const LINE_ENDS");
  return (at < 0 ? text : text.slice(0, at)).trim();
}

export async function drive(args: string[], ctx: RunContext): Promise<CommandResult> {
  const o: StageOptions & { scale: number; actions?: Action[] } = { width: 1440, height: 1100, scale: 1 };
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = () => args[++i] ?? "";
    if (arg === "--width") o.width = Number(next());
    else if (arg === "--height") o.height = Number(next());
    else if (arg === "--scale") o.scale = Number(next());
    else if (arg === "--reduced") o.reduced = true;
    else if (arg === "--theme") o.theme = next() as "dark" | "light";
    else if (arg === "--no-webgl") o.noWebgl = true;
    else if (arg === "--preload") o.preload = ctx.vfs.text(ctx.vfs.key(next(), ctx.cwd));
    else if (arg === "--actions") o.actions = JSON.parse(ctx.vfs.text(ctx.vfs.key(next(), ctx.cwd)));
    else rest.push(arg);
  }
  const [target, inline] = rest;
  if (!target) return { exitCode: 1, output: "usage: node scripts/drive.mjs <page.html> '<actions JSON>' | --actions steps.json", images: [] };
  const actions: Action[] = o.actions ?? JSON.parse(inline ?? "[]");
  if (!Array.isArray(actions)) throw new Error("Actions must be a JSON array of arrays");
  return runActions(ctx, target, o, actions);
}

async function runActions(ctx: RunContext, target: string, o: StageOptions & { scale: number }, actions: Action[]): Promise<CommandResult> {
  const images: string[] = [];
  const out: string[] = [];
  const stage = staged(ctx);
  let failed = 0;
  await loadPage(ctx, target, o);
  await sleep(1200, ctx.signal);
  const capture = (selector: unknown, scale: unknown, region: unknown, rings?: Array<[number, number]>) =>
    stage.call<string>("shot", [selector ?? null, Number(scale ?? 1), region ?? undefined, rings]);
  try {
    for (const action of actions) {
      const [kind, ...a] = action;
      if (kind === "wait") await sleep(Number(a[0]), ctx.signal);
      else if (kind === "scroll") await stage.call("scroll", [a[0] ?? null]);
      else if (kind === "move") await stage.call("move", [a[0] ?? null, a[1], a[2]]);
      else if (kind === "click") await stage.call("click", [a[0] ?? null, a[1], a[2]]);
      else if (kind === "drag") await stage.call("drag", [a[0] ?? null, a[1], a[2], a[3], a[4], a[5]]);
      else if (kind === "key") await stage.call("key", [a[0], a[1] ?? null, a[2]]);
      else if (kind === "slow") await stage.call("slow", [a[0]]);
      else if (kind === "eval") out.push(`eval: ${JSON.stringify(await stage.call("eval", [a[0]]))}`);
      else if (kind === "until") await stage.call("until", [a[0], a[1] ?? 10000], Number(a[1] ?? 10000) + 5000);
      else if (kind === "turn") await stage.call("turn", [a[0], a[1]]);
      else if (kind === "shot") {
        const [file, selector, scale, region] = a;
        savePng(ctx, String(file), await capture(selector, scale, region), images);
        out.push(`shot ${file} · readout "${await stage.call<string>("readout", [selector ?? null])}"`);
      } else if (kind === "sheet") {
        const [file, every, count, selector, scale, region, columns] = a as [string, number, number, unknown, unknown, unknown, number?];
        const frames: Uint8Array[] = [];
        const texts: string[] = [];
        for (let index = 0; index < count; index++) {
          if (index) await sleep(every, ctx.signal);
          frames.push(dataUrlToBytes(await capture(selector, scale ?? 0.5, region)));
          texts.push(await stage.call<string>("readout", [selector ?? null]));
        }
        const key = ctx.vfs.key(file, ctx.cwd);
        ctx.vfs.write(key, await tile(frames, frames.map((_, i) => String(i)), columns ?? Math.min(count, 6)));
        images.push(key);
        out.push(`sheet ${file} · ${count} frames every ${every} ms · readouts ${texts.map((t, i) => `${i}:"${t}"`).join(" ")}`);
      } else if (kind === "orbit") {
        const [file, from, to, step, selector, scale, region, columns] = a as [string, number, number, number, unknown, unknown, unknown, number?];
        if (!step || (step > 0 ? from > to : from < to)) throw new Error(`orbit needs a nonzero step that moves from ${from} toward ${to}`);
        const frames: Uint8Array[] = [];
        const labels: string[] = [];
        for (let at = from; step > 0 ? at <= to + 1e-9 : at >= to - 1e-9; at += step) {
          const angle = Math.round(at * 1000) / 1000;
          await stage.call("turn", [angle]);
          frames.push(dataUrlToBytes(await capture(selector, scale ?? 0.5, region)));
          labels.push(`${angle}°`);
        }
        const key = ctx.vfs.key(file, ctx.cwd);
        ctx.vfs.write(key, await tile(frames, labels, columns ?? 6));
        images.push(key);
        out.push(`orbit ${file} · ${frames.length} frames ${from}°…${to}° every ${step}°`);
      } else if (kind === "lines") {
        const [file, selector, extra] = a as [string | null | undefined, string | null | undefined, Record<string, unknown> | undefined];
        const result = await stage.call<LineResult | null>("lines", [lineEndsSource(ctx), { select: selector ?? null, ...(extra ?? {}) }]);
        if (!result) {
          out.push("lines: the check did not run");
          failed++;
          continue;
        }
        out.push(`line ends: ${result.problems.length} of ${result.ends} ends on ${result.lines} lines float`);
        for (const p of result.problems) {
          out.push(`  ${p.what}  ${p.end}${p.mark ? " (a mark: neither end rooted)" : ""}  ${p.gap == null ? "nothing nearby" : `${p.gap.toFixed(2)} px from anything`}   at card ${p.at.join(",")}   length ${p.length}   d ${p.d}…${p.opacity < 1 ? `   opacity ${p.opacity}` : ""}`);
        }
        if (file) {
          savePng(ctx, file, await capture(selector, 2, undefined, result.problems.map((p) => p.at)), images);
          out.push(`shot ${file}`);
        }
        failed += result.problems.length;
      } else throw new Error(`Unknown action: ${JSON.stringify(action)}`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    out.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    out.push(problemsText(await stage.call<string[]>("problems").catch(() => [])));
    return { exitCode: 1, output: out.join("\n"), images };
  }
  out.push(problemsText(await stage.call<string[]>("problems")));
  return { exitCode: failed ? 1 : 0, output: out.join("\n"), images };
}

// --- lines.mjs ------------------------------------------------------------------------

export async function lines(args: string[], ctx: RunContext): Promise<CommandResult> {
  const argv = [...args];
  const take = (flag: string, fallback: string | null) => {
    const at = argv.indexOf(flag);
    if (at < 0) return fallback;
    const value = argv[at + 1];
    argv.splice(at, 2);
    return value;
  };
  const out = take("--out", null);
  const tolerance = Number(take("--tolerance", "1"));
  const select = take("--select", null);
  const wait = Number(take("--wait", "1500"));
  const [target, ...flags] = argv;
  if (!target) return { exitCode: 1, output: "usage: node scripts/lines.mjs <page.html> [--out marks.png] [--tolerance 1] [--select css]", images: [] };
  return drive([target, JSON.stringify([["wait", wait], ["lines", out, select, { tolerance }]]), ...flags], ctx);
}
