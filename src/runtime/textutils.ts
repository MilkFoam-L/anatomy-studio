// Small versions of the text tools models reach for out of habit (grep, head, sed -n …),
// over the virtual file system. Enough to save a round trip; not POSIX-complete.
import type { RunContext } from "./context";
import { keyOf, resolve } from "./paths";

export interface TextResult {
  output: string;
  exitCode: number;
}

const ok = (output: string): TextResult => ({ output, exitCode: 0 });

function filesUnder(ctx: RunContext, path: string): string[] {
  const key = keyOf(resolve(ctx.cwd, path));
  if (key === null) throw new Error(`${path}: outside the workspace`);
  if (ctx.vfs.has(key)) return [key];
  const prefix = key ? `${key}/` : "";
  return Object.keys(ctx.vfs.textFiles()).filter((k) => k.startsWith(prefix)).sort();
}

const glob = (pattern: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);

/** Reads `file` args, or stdin when there are none. */
function inputs(ctx: RunContext, files: string[], stdin: string | null): Array<{ name: string; text: string }> {
  if (!files.length) return [{ name: "(stdin)", text: stdin ?? "" }];
  return files.map((file) => {
    const key = ctx.vfs.key(file, ctx.cwd);
    return { name: file, text: ctx.vfs.text(key) };
  });
}

const linesOf = (text: string) => {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
};

export function grep(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const flags = new Set<string>();
  let before = 0;
  let after = 0;
  let pattern: string | null = null;
  const include: RegExp[] = [];
  const paths: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const num = (value: string | undefined) => Number(value ?? 0) || 0;
    if (arg === "-e") pattern = args[++i];
    else if (/^-[ABC]$/.test(arg)) {
      const n = num(args[++i]);
      if (arg !== "-B") after = n;
      if (arg !== "-A") before = n;
    } else if (/^-[ABC]\d+$/.test(arg)) {
      const n = num(arg.slice(2));
      if (arg[1] !== "B") after = n;
      if (arg[1] !== "A") before = n;
    } else if (arg.startsWith("--include=")) include.push(glob(arg.slice(10)));
    else if (arg.startsWith("--")) continue;
    else if (/^-[a-zA-Z]+$/.test(arg)) for (const f of arg.slice(1)) flags.add(f);
    else if (pattern === null) pattern = arg;
    else paths.push(arg);
  }
  if (pattern === null) return { output: "grep: no pattern", exitCode: 2 };
  const source = flags.has("F") ? pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : flags.has("E") ? pattern : pattern.replace(/\\([|(){}+?])/g, "$1");
  const re = new RegExp(flags.has("w") ? `\\b(?:${source})\\b` : source, `${flags.has("i") ? "i" : ""}${flags.has("o") ? "g" : ""}`);
  const targets = paths.length ? paths.flatMap((p) => filesUnder(ctx, p)).filter((k) => !include.length || include.some((g) => g.test(k.split("/").pop() ?? ""))) : [];
  const sources = paths.length ? targets.map((k) => ({ name: k, text: ctx.vfs.text(k) })) : inputs(ctx, [], stdin);
  const showName = (sources.length > 1 || flags.has("r")) && !flags.has("h");
  const out: string[] = [];
  let matched = 0;
  for (const { name, text } of sources) {
    const lines = linesOf(text);
    const hits: number[] = [];
    lines.forEach((line, index) => {
      re.lastIndex = 0;
      if (re.test(line) !== flags.has("v")) hits.push(index);
    });
    matched += hits.length;
    if (!hits.length) continue;
    if (flags.has("l")) {
      out.push(name);
      continue;
    }
    if (flags.has("c")) {
      out.push(showName ? `${name}:${hits.length}` : String(hits.length));
      continue;
    }
    const prefix = (index: number, sep: string) => `${showName ? `${name}${sep}` : ""}${flags.has("n") ? `${index + 1}${sep}` : ""}`;
    if (flags.has("o")) {
      for (const index of hits) for (const m of lines[index].matchAll(new RegExp(re.source, `g${re.flags.replace("g", "")}`))) out.push(prefix(index, ":") + m[0]);
      continue;
    }
    const shown = new Set<number>();
    let last = -2;
    for (const hit of hits) {
      for (let i = Math.max(0, hit - before); i <= Math.min(lines.length - 1, hit + after); i++) {
        if (shown.has(i)) continue;
        if ((before || after) && last >= 0 && i > last + 1) out.push("--");
        out.push(prefix(i, i === hit || hits.includes(i) ? ":" : "-") + lines[i]);
        shown.add(i);
        last = i;
      }
    }
  }
  return { output: out.join("\n"), exitCode: matched ? 0 : 1 };
}

function count(args: string[], fallback: number): { n: number; fromStart: boolean; files: string[] } {
  let n = fallback;
  let fromStart = false;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-n" || arg === "-c") {
      const value = args[++i] ?? "";
      fromStart = value.startsWith("+");
      n = Math.abs(Number(value)) || 0;
    } else if (/^-\d+$/.test(arg)) n = Number(arg.slice(1));
    else if (/^-n\+?\d+$/.test(arg)) {
      fromStart = arg[2] === "+";
      n = Number(arg.slice(fromStart ? 3 : 2));
    } else files.push(arg);
  }
  return { n, fromStart, files };
}

export function head(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const { n, files } = count(args, 10);
  return ok(inputs(ctx, files, stdin).map(({ text }) => linesOf(text).slice(0, n).join("\n")).join("\n"));
}

export function tail(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const { n, fromStart, files } = count(args, 10);
  return ok(inputs(ctx, files, stdin).map(({ text }) => {
    const lines = linesOf(text);
    return (fromStart ? lines.slice(Math.max(0, n - 1)) : lines.slice(-n)).join("\n");
  }).join("\n"));
}

export function wc(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const flags = args.filter((a) => a.startsWith("-")).join("");
  const files = args.filter((a) => !a.startsWith("-"));
  return ok(inputs(ctx, files, stdin).map(({ name, text }) => {
    const parts = [];
    if (!flags || flags.includes("l")) parts.push(linesOf(text).length);
    if (!flags || flags.includes("w")) parts.push(text.split(/\s+/).filter(Boolean).length);
    if (!flags || flags.includes("c")) parts.push(new TextEncoder().encode(text).length);
    return `${parts.join(" ")}${files.length ? ` ${name}` : ""}`;
  }).join("\n"));
}

/** sed -n 'A,Bp' / 'Np' / '/re/p', and 's/a/b/g'. */
export function sed(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const quiet = args.includes("-n");
  const rest = args.filter((a) => a !== "-n" && a !== "-E");
  const script = rest.shift() ?? "";
  const text = inputs(ctx, rest, stdin).map((i) => i.text).join("\n");
  const lines = linesOf(text);
  const range = script.match(/^(\d+|\$)(?:,(\d+|\$))?p$/);
  if (range) {
    const at = (v: string) => (v === "$" ? lines.length : Number(v));
    const from = at(range[1]);
    const to = range[2] ? at(range[2]) : from;
    const picked = lines.slice(from - 1, to);
    return ok(quiet ? picked.join("\n") : lines.flatMap((l, i) => (i + 1 >= from && i + 1 <= to ? [l, l] : [l])).join("\n"));
  }
  const match = script.match(/^\/(.+)\/p$/);
  if (match) {
    const re = new RegExp(match[1]);
    return ok(lines.filter((l) => re.test(l)).join("\n"));
  }
  const sub = script.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
  if (sub) {
    const re = new RegExp(sub[2], sub[4].includes("g") ? `g${sub[4].includes("i") ? "i" : ""}` : sub[4]);
    return ok(lines.map((l) => l.replace(re, sub[3])).join("\n"));
  }
  return { output: `sed: only -n 'A,Bp', '/re/p' and 's/a/b/' are supported here; use read_file with offset/limit`, exitCode: 1 };
}

export function sort(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const flags = args.filter((a) => a.startsWith("-")).join("");
  const lines = inputs(ctx, args.filter((a) => !a.startsWith("-")), stdin).flatMap((i) => linesOf(i.text));
  let out = flags.includes("n") ? [...lines].sort((a, b) => parseFloat(a) - parseFloat(b)) : [...lines].sort();
  if (flags.includes("r")) out.reverse();
  if (flags.includes("u")) out = [...new Set(out)];
  return ok(out.join("\n"));
}

export function uniq(args: string[], stdin: string | null, ctx: RunContext): TextResult {
  const counting = args.includes("-c");
  const lines = inputs(ctx, args.filter((a) => !a.startsWith("-")), stdin).flatMap((i) => linesOf(i.text));
  const out: Array<[string, number]> = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last && last[0] === line) last[1]++;
    else out.push([line, 1]);
  }
  return ok(out.map(([l, c]) => (counting ? `${String(c).padStart(7)} ${l}` : l)).join("\n"));
}

export function find(args: string[], _stdin: string | null, ctx: RunContext): TextResult {
  const roots: string[] = [];
  let name: RegExp | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-name" || args[i] === "-iname") name = new RegExp(glob(args[++i]).source, args[i - 1] === "-iname" ? "i" : "");
    else if (args[i] === "-type" || args[i] === "-maxdepth") i++;
    else if (!args[i].startsWith("-")) roots.push(args[i]);
  }
  const out = (roots.length ? roots : ["."]).flatMap((root) => {
    const base = keyOf(resolve(ctx.cwd, root)) ?? "";
    const all = [...new Set([...Object.keys(ctx.vfs.textFiles()), ...ctx.vfs.changed()])];
    return all
      .filter((k) => (base ? k === base || k.startsWith(`${base}/`) : true))
      .filter((k) => !name || name.test(k.split("/").pop() ?? ""))
      .map((k) => (root === "." ? `./${base ? k.slice(base.length + 1) : k}` : `${root.replace(/\/$/, "")}/${base ? k.slice(base.length + 1) : k}`.replace(/\/$/, "")));
  });
  return ok(out.sort().join("\n"));
}

export const TEXT_TOOLS: Record<string, (args: string[], stdin: string | null, ctx: RunContext) => TextResult> = { grep, head, tail, wc, sed, sort, uniq, find };
