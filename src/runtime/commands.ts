// The `run` tool: a minimal shell for the commands SKILL.md documents. `node` runs
// scripts in the sandboxed worker; the Chrome-based checks are routed to the stage.
import { capture, drive, lines } from "../stage/commands";
import type { CommandResult, RunContext } from "./context";
import { keyOf, resolve, ROOT } from "./paths";
import { parseCommand } from "./shell";
import { TEXT_TOOLS } from "./textutils";

const MAX_OUTPUT = 24000;

export function clip(text: string, max = MAX_OUTPUT): string {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.4));
  const tail = text.slice(-Math.floor(max * 0.6));
  return `${head}\n… [${text.length - head.length - tail.length} characters cut] …\n${tail}`;
}

const STAGE_SCRIPTS: Record<string, (args: string[], ctx: RunContext) => Promise<CommandResult>> = {
  "scripts/capture.mjs": capture,
  "scripts/drive.mjs": drive,
  "scripts/lines.mjs": lines,
};

const UNSUPPORTED: Record<string, string> = {
  "scripts/print.mjs": "PDF printing needs Chrome and is not available in the browser studio.",
  "scripts/publish.mjs": "Publishing to the community gallery is not available in the browser studio.",
  "scripts/turn-check.mjs": "turn-check needs Chrome DevTools; use drive.mjs with [\"turn\"] / [\"orbit\"] actions and the build's --audit instead.",
  "scripts/turn-bench.mjs": "turn-bench is not available in the browser studio.",
};

let evalSeq = 0;

/** `node -e code` / `node -p expr`: run the code as a temporary module in the working directory. */
async function nodeEval(argv: string[], at: number, ctx: RunContext): Promise<CommandResult> {
  const flag = argv[at];
  const source = argv[at + 1] ?? "";
  const code = flag === "-p" || flag === "--print" ? `console.log(await (${source}));` : source;
  const key = keyOf(resolve(ctx.cwd, `.studio-eval-${++evalSeq}.mjs`));
  if (key === null) return { exitCode: 1, output: "node -e: the working directory is outside the workspace", images: [] };
  ctx.vfs.write(key, code);
  try {
    const result = await ctx.node.run(ctx.vfs, ctx.cwd, [`${ROOT}/${key}`, ...argv.slice(at + 2)], ctx.timeoutMs, ctx.signal);
    return { exitCode: result.exitCode, output: result.output, images: result.written.filter((k) => k.endsWith(".png")) };
  } finally {
    ctx.vfs.remove(key);
  }
}

async function node(argv: string[], ctx: RunContext): Promise<CommandResult> {
  const evalAt = argv.findIndex((arg) => ["-e", "--eval", "-p", "--print"].includes(arg));
  const scriptIndex = argv.findIndex((arg) => !arg.startsWith("-"));
  if (evalAt >= 0 && (scriptIndex < 0 || evalAt < scriptIndex)) return nodeEval(argv, evalAt, ctx);
  if (scriptIndex < 0) return { exitCode: 1, output: "node: give a script to run, e.g. node work/my-figure/build.mjs --light", images: [] };
  const script = argv[scriptIndex];
  const args = argv.slice(scriptIndex + 1);
  const absolute = resolve(ctx.cwd, script);
  const key = keyOf(absolute);
  if (key === null) return { exitCode: 1, output: `node: ${script} is outside the workspace`, images: [] };
  if (STAGE_SCRIPTS[key]) return STAGE_SCRIPTS[key](args, ctx);
  if (UNSUPPORTED[key]) return { exitCode: 1, output: UNSUPPORTED[key], images: [] };
  if (!ctx.vfs.has(key)) return { exitCode: 1, output: `Error: Cannot find module '${absolute}'`, images: [] };
  const result = await ctx.node.run(ctx.vfs, ctx.cwd, [absolute, ...args], ctx.timeoutMs, ctx.signal);
  return { exitCode: result.exitCode, output: result.output, images: result.written.filter((k) => k.endsWith(".png")) };
}

function listing(ctx: RunContext, target = "."): CommandResult {
  const key = keyOf(resolve(ctx.cwd, target));
  if (key === null) return { exitCode: 1, output: `ls: ${target}: outside the workspace`, images: [] };
  if (ctx.vfs.has(key)) return { exitCode: 0, output: target, images: [] };
  const entries = ctx.vfs.list(key);
  if (!entries.length && key) return { exitCode: 1, output: `ls: ${target}: No such file or directory`, images: [] };
  return { exitCode: 0, output: entries.join("\n"), images: [] };
}

async function runSimple(argv: string[], stdin: string | null, ctx: RunContext, setCwd: (cwd: string) => void): Promise<CommandResult> {
  const [name, ...args] = argv;
  const cwd = ctx.cwd;
  if (name === "cd") {
    const target = resolve(cwd, args[0] ?? ROOT);
    const key = keyOf(target);
    if (key === null || (key && !ctx.vfs.isDir(key))) return { exitCode: 1, output: `cd: ${args[0]}: No such directory`, images: [] };
    setCwd(target);
    return { exitCode: 0, output: "", images: [] };
  }
  if (name === "node") return node(args, ctx);
  if (name === "ls") return listing(ctx, args.find((a) => !a.startsWith("-")));
  if (name === "pwd") return { exitCode: 0, output: cwd, images: [] };
  if (name === "echo") return { exitCode: 0, output: args.filter((a) => a !== "-n" && a !== "-e").join(" "), images: [] };
  if (name === "mkdir" || name === "true" || name === "date" || name === "clear") return { exitCode: 0, output: name === "date" ? new Date().toString() : "", images: [] };
  if (name === "cat") {
    const files = args.filter((a) => !a.startsWith("-"));
    return { exitCode: 0, output: files.length ? files.map((a) => ctx.vfs.text(ctx.vfs.key(a, cwd))).join("\n") : stdin ?? "", images: [] };
  }
  const text = TEXT_TOOLS[name];
  if (text) return { ...text(args, stdin, ctx), images: [] };
  return {
    exitCode: 127,
    output: `${name}: not available. This browser studio runs node <script.mjs>, cd, ls, cat, pwd, echo, grep, head, tail, sed -n, wc, sort, uniq, find and pipes. Use the file tools for anything else.`,
    images: [],
  };
}

export async function runCommand(line: string, ctx: RunContext): Promise<{ result: CommandResult; cwd: string }> {
  const { steps, background } = parseCommand(line);
  const outputs: string[] = [];
  const images: string[] = [];
  let cwd = ctx.cwd;
  let exitCode = 0;
  for (const step of steps) {
    if (ctx.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if ((step.after === "&&" && exitCode !== 0) || (step.after === "||" && exitCode === 0)) continue;
    let stdin: string | null = null;
    let result: CommandResult = { exitCode: 0, output: "", images: [] };
    for (const command of step.pipeline) {
      try {
        result = await runSimple(command.argv, command.stdin ?? stdin, { ...ctx, cwd }, (next) => (cwd = next));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        result = { exitCode: 1, output: error instanceof Error ? error.message : String(error), images: [] };
      }
      images.push(...result.images);
      if (command.redirect) {
        const key = ctx.vfs.key(command.redirect, cwd);
        const before = command.append && ctx.vfs.has(key) ? ctx.vfs.text(key) : "";
        ctx.vfs.write(key, `${before}${result.output}${result.output.endsWith("\n") ? "" : "\n"}`);
        result = { ...result, output: `[output written to ${command.redirect}]` };
      }
      stdin = result.output;
    }
    outputs.push(result.output);
    exitCode = result.exitCode;
  }
  const note = background ? "[ran in the foreground: background jobs are not supported here]\n" : "";
  return { result: { exitCode, output: clip(note + outputs.filter(Boolean).join("\n")), images }, cwd };
}
