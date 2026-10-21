// The tools the model works with. They mirror what Claude Code gives the skill: read,
// write and edit files, search, and run `node` — over the in-browser workspace.
import type { ToolSpec } from "../llm/types";
import { clip, runCommand } from "../runtime/commands";
import type { CommandResult, RunContext } from "../runtime/context";
import { keyOf, resolve, ROOT } from "../runtime/paths";

export const TOOLS: ToolSpec[] = [
  {
    name: "read_file",
    description: "Read a file from the workspace (the skill folder). Text comes back with line numbers; a .png comes back as an image. Use offset/limit for long files.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the workspace root (never the shell's cd), e.g. references/kit.md" },
        offset: { type: "integer", description: "1-based line to start at" },
        limit: { type: "integer", description: "Number of lines (default 2000)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a text file in the workspace.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace an exact string in a file. old_string must occur exactly once unless replace_all is true.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "list_files",
    description: "List a directory of the workspace.",
    input_schema: { type: "object", properties: { path: { type: "string", description: "Directory, default the root" } } },
  },
  {
    name: "grep",
    description: "Search file contents with a JavaScript regular expression. Returns matching lines as path:line: text.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "File or directory to search, default the root" },
        ignore_case: { type: "boolean" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run",
    description:
      "Run a command in the browser runtime. Supported: `node <script.mjs> [args]` (build scripts and the kit audit run for real; scripts/capture.mjs, scripts/drive.mjs and scripts/lines.mjs take real screenshots of a page), plus cd, ls, cat, grep, head, tail, sed -n, wc, sort, uniq, find, pipes, `&&` and `> file` redirects. Screenshots a command writes are attached to the result.",
    input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
  {
    name: "finish",
    description: "Deliver the finished figure. Call once, after the checks, with the page the user should get.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Path of the finished page (.html or .svg)" },
        title: { type: "string", description: "A short title for the figure" },
        summary: { type: "string", description: "Two or three sentences for the user, in their language: what the object is and how it explains the idea" },
        files: { type: "array", items: { type: "string" }, description: "Other files worth keeping (build script, extra theme)" },
      },
      required: ["page", "summary"],
    },
  },
];

export interface ToolOutcome {
  text: string;
  isError: boolean;
  /** PNG keys to attach as images. */
  images: string[];
  finished?: { page: string; title?: string; summary: string; files: string[] };
}

const ok = (text: string, images: string[] = []): ToolOutcome => ({ text, isError: false, images });
const fail = (text: string): ToolOutcome => ({ text, isError: true, images: [] });

function numbered(text: string, offset = 1, limit = 2000): string {
  const lines = text.split("\n");
  const start = Math.max(1, offset);
  const slice = lines.slice(start - 1, start - 1 + limit);
  const body = slice.map((line, i) => `${String(start + i).padStart(6)}\t${line.length > 2000 ? `${line.slice(0, 2000)}…` : line}`).join("\n");
  const more = start - 1 + slice.length < lines.length ? `\n[${lines.length - (start - 1 + slice.length)} more lines; continue with offset ${start + slice.length}]` : "";
  return body + more;
}

function grep(ctx: RunContext, pattern: string, path = ".", ignoreCase = false): string {
  let re: RegExp;
  try {
    re = new RegExp(pattern, ignoreCase ? "i" : "");
  } catch (error) {
    return `Invalid pattern: ${(error as Error).message}`;
  }
  const base = keyOf(resolve(ROOT, path)) ?? "";
  const out: string[] = [];
  for (const [key, text] of Object.entries(ctx.vfs.textFiles())) {
    if (base && key !== base && !key.startsWith(`${base}/`)) continue;
    text.split("\n").forEach((line, i) => {
      if (out.length < 300 && re.test(line)) out.push(`${key}:${i + 1}: ${line.slice(0, 300)}`);
    });
  }
  return out.length ? out.join("\n") + (out.length >= 300 ? "\n[stopped at 300 matches]" : "") : "No matches.";
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: RunContext, setCwd: (cwd: string) => void): Promise<ToolOutcome> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("The tool input must be a JSON object.");
  if ("__invalid_json" in input) return fail("The tool input was not valid JSON (it may have been cut off by the output limit). Send it again, splitting very large files into smaller modules.");
  const str = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  try {
    switch (name) {
      case "read_file": {
        const key = ctx.vfs.key(str("path"), ROOT);
        const data = ctx.vfs.get(key);
        if (data === undefined) return fail(ctx.vfs.isDir(key) ? `${str("path")} is a directory; use list_files` : `No such file: ${str("path")}`);
        if (key.endsWith(".png")) return ok(`Image ${key}`, [key]);
        if (typeof data !== "string") return fail(`${key} is a binary file`);
        return ok(numbered(data, Number(input.offset ?? 1), Number(input.limit ?? 2000)));
      }
      case "write_file": {
        const key = ctx.vfs.key(str("path"), ROOT);
        ctx.vfs.write(key, str("content"));
        return ok(`Wrote ${key} (${str("content").split("\n").length} lines)`);
      }
      case "edit_file": {
        const key = ctx.vfs.key(str("path"), ROOT);
        const text = ctx.vfs.text(key);
        const from = str("old_string");
        if (!from) return fail("old_string is empty");
        const count = text.split(from).length - 1;
        if (count === 0) return fail(`old_string was not found in ${key}`);
        if (count > 1 && !input.replace_all) return fail(`old_string occurs ${count} times in ${key}; add more context or set replace_all`);
        ctx.vfs.write(key, input.replace_all ? text.split(from).join(str("new_string")) : text.replace(from, () => str("new_string")));
        return ok(`Edited ${key}${count > 1 ? ` (${count} places)` : ""}`);
      }
      case "list_files": {
        const key = keyOf(resolve(ROOT, str("path") || "."));
        if (key === null) return fail("Path is outside the workspace");
        const entries = ctx.vfs.list(key);
        return entries.length ? ok(entries.join("\n")) : fail(`No such directory: ${str("path") || "."}`);
      }
      case "grep":
        return ok(grep(ctx, str("pattern"), str("path") || ".", Boolean(input.ignore_case)));
      case "run": {
        const { result, cwd } = await runCommand(str("command"), ctx);
        setCwd(cwd);
        return outcomeOf(result);
      }
      case "finish": {
        const key = ctx.vfs.key(str("page"), ROOT);
        if (!ctx.vfs.has(key)) return fail(`No such page: ${str("page")}. Build it first.`);
        const files = Array.isArray(input.files) ? (input.files as unknown[]).map(String).map((p) => ctx.vfs.key(p, ROOT)).filter((k) => ctx.vfs.has(k)) : [];
        return { ...ok("Delivered."), finished: { page: key, title: str("title") || undefined, summary: str("summary"), files } };
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function outcomeOf(result: CommandResult): ToolOutcome {
  const text = clip(`${result.output || "(no output)"}\n[exit code ${result.exitCode}]`);
  return { text, isError: false, images: [...new Set(result.images)].slice(-6) };
}
