// The agent loop: ask the model, run the tools it calls, feed back the results, until it
// calls finish or the round budget runs out.
import { forModel } from "../lib/images";
import { complete } from "../llm/client";
import { emptyUsage, type AssistantBlock, type ImageBlock, type Message, type ProviderSettings, type TextBlock, type ToolResultBlock, type Usage } from "../llm/types";
import type { RunContext } from "../runtime/context";
import type { NodeRuntime } from "../runtime/node";
import { ROOT } from "../runtime/paths";
import { Vfs, type FileData } from "../runtime/vfs";
import { inlineLocalAssets, type Stage } from "../stage/stage";
import { compactHistory } from "./history";
import { QUALITY, systemPrompt, userPrompt, workDirFor, type JobOptions } from "./prompt";
import { runTool, TOOLS } from "./tools";

export type AgentEvent =
  | { type: "turn"; turn: number; maxTurns: number }
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_progress"; id: string; bytes: number }
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; text: string; isError: boolean; images: Array<{ key: string; bytes: Uint8Array }> }
  | { type: "usage"; usage: Usage }
  | { type: "retry"; attempt: number; message: string; waitMs: number }
  | { type: "notice"; text: string };

export interface AgentResult {
  page: string;
  html: string;
  title: string;
  summary: string;
  files: Record<string, FileData>;
  usage: Usage;
  turns: number;
}

export interface AgentEnv {
  skillFiles: Record<string, string>;
  node: NodeRuntime;
  stage: Stage;
}

const NODE_TIMEOUT_MS = 180_000;

function addUsage(total: Usage, part: Usage): Usage {
  return { input: total.input + part.input, output: total.output + part.output, cacheRead: total.cacheRead + part.cacheRead, cacheWrite: total.cacheWrite + part.cacheWrite };
}

const text = (value: string): TextBlock => ({ type: "text", text: value });

/** Keeps blocks the API accepts back: no empty text blocks. */
const cleaned = (content: AssistantBlock[]) => content.filter((b) => b.type !== "text" || b.text.trim().length > 0);

/** The page written last, preferring the work directory over pages written elsewhere. */
function newestPage(vfs: Vfs, dir: string): string | null {
  const pages = vfs.recent().filter((k) => /\.(html|svg)$/.test(k) && !k.includes("/shots/"));
  const own = pages.filter((k) => k.startsWith(`${dir}/`));
  const pick = own.length ? own : pages;
  return pick.length ? pick[pick.length - 1] : null;
}

/** The page as the checks saw it: local scripts and stylesheets inlined, an SVG wrapped. */
function previewHtml(vfs: Vfs, page: string): string {
  const source = vfs.text(page);
  if (page.endsWith(".svg")) return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;display:grid;place-items:center;min-height:100vh">${source}</body></html>`;
  return inlineLocalAssets(source, page, vfs);
}

/**
 * One figure's conversation. `run` starts it from the user's request; `followUp` carries
 * on in the same workspace and context with the user's revision notes.
 */
export class AgentSession {
  readonly vfs: Vfs;
  readonly workDir: string;
  private readonly system: string;
  private readonly messages: Message[];
  /** Tool results still owed to the model (the finish call's), sent with the next message. */
  private owed: ToolResultBlock[] = [];
  private cwd = ROOT;
  private usage = emptyUsage();
  private turns = 0;

  get model(): string {
    return this.settings.model;
  }

  constructor(readonly job: JobOptions, private readonly settings: ProviderSettings, private readonly env: AgentEnv) {
    this.vfs = new Vfs(env.skillFiles);
    this.workDir = workDirFor(job.prompt);
    this.system = systemPrompt(env.skillFiles, job, this.workDir);
    this.messages = [];
  }

  run(onEvent: (event: AgentEvent) => void, signal: AbortSignal): Promise<AgentResult> {
    return this.loop([text(userPrompt(this.job))], QUALITY[this.job.quality].rounds, onEvent, signal);
  }

  followUp(note: string, onEvent: (event: AgentEvent) => void, signal: AbortSignal): Promise<AgentResult> {
    const rounds = Math.max(15, Math.round(QUALITY[this.job.quality].rounds / 2));
    const ask = `${note.trim()}\n\n[studio] The user asks for this revision of the figure you delivered. Change what they ask, keep the rest, rebuild, check it, and call finish again.`;
    return this.loop([text(ask)], rounds, onEvent, signal);
  }

  /** The newest page built so far, for when a run fails or is stopped before finish. */
  snapshot(): AgentResult | null {
    const page = newestPage(this.vfs, this.workDir);
    return page ? this.deliver(page, "", "") : null;
  }

  /** After an interruption the last assistant turn may hold tool calls without results. */
  private settleTail(): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role !== "assistant") return;
    const pending = last.content.filter((b) => b.type === "tool_use");
    if (!this.owed.length) this.owed = pending.map((call) => ({ type: "tool_result", tool_use_id: call.id, content: [text("(interrupted)")], is_error: true }));
  }

  private deliver(page: string, title: string, summary: string, extra: string[] = []): AgentResult {
    const { vfs, workDir } = this;
    const keep = new Set([page, ...extra, ...vfs.changed().filter((k) => k.startsWith(`${workDir}/`) && !k.includes("/shots/") && !k.endsWith(".png"))]);
    const files: Record<string, FileData> = {};
    for (const key of keep) {
      const data = vfs.get(key);
      if (data !== undefined) files[key] = data;
    }
    return { page, html: previewHtml(vfs, page), title, summary, files, usage: this.usage, turns: this.turns };
  }

  private async loop(opening: TextBlock[], maxTurns: number, onEvent: (event: AgentEvent) => void, signal: AbortSignal): Promise<AgentResult> {
    const { vfs, workDir } = this;
    this.settleTail();
    this.messages.push({ role: "user", content: [...this.owed, ...opening] });
    this.owed = [];
    let nudged = false;
    let finalCall = false;

    for (let turn = 1; ; turn++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (turn > maxTurns + 3) {
        // Only replies without tool calls (output-limit continuations) get this far.
        const fallback = newestPage(vfs, workDir);
        if (fallback) return this.deliver(fallback, "", "", []);
        throw new Error("The round budget ran out before a page was built.");
      }
      this.turns++;
      onEvent({ type: "turn", turn, maxTurns });
      const reply = await complete(
        this.settings,
        { system: this.system, messages: compactHistory(this.messages), tools: TOOLS, signal },
        (event) => onEvent(event),
        (attempt, error, waitMs) => onEvent({ type: "retry", attempt, message: error.message, waitMs }),
      );
      this.usage = addUsage(this.usage, reply.usage);
      onEvent({ type: "usage", usage: this.usage });
      const content = cleaned(reply.content);
      this.messages.push({ role: "assistant", content: content.length ? content : [text("(no reply)")] });

      const calls = content.filter((b) => b.type === "tool_use");
      if (!calls.length) {
        if (reply.stopReason === "max_tokens") {
          this.messages.push({ role: "user", content: [text("Your reply hit the output limit. Continue, and split large files into smaller modules.")] });
          continue;
        }
        if (!nudged) {
          nudged = true;
          this.messages.push({ role: "user", content: [text("Continue the work. When the figure is built and checked, call the finish tool: it is the only way the user receives it.")] });
          continue;
        }
        const fallback = newestPage(vfs, workDir);
        if (fallback) return this.deliver(fallback, "", "", []);
        throw new Error("The model stopped without building a page.");
      }

      const results: ToolResultBlock[] = [];
      let finished: AgentResult | null = null;
      for (const call of calls) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        onEvent({ type: "tool_call", id: call.id, name: call.name, input: call.input });
        const ctx: RunContext = { vfs, cwd: this.cwd, node: this.env.node, stage: this.env.stage, timeoutMs: NODE_TIMEOUT_MS, signal };
        const outcome = await runTool(call.name, call.input, ctx, (next) => (this.cwd = next));
        const shots = outcome.images.flatMap((key) => {
          const data = vfs.get(key);
          return data instanceof Uint8Array ? [{ key, bytes: data }] : [];
        });
        onEvent({ type: "tool_result", id: call.id, text: outcome.text, isError: outcome.isError, images: shots });
        const images: ImageBlock[] = [];
        for (const shot of shots) {
          const image = await forModel(shot.bytes);
          images.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } });
        }
        const labelled = shots.length ? `${outcome.text}\n[attached: ${shots.map((s) => s.key).join(", ")}]` : outcome.text;
        results.push({ type: "tool_result", tool_use_id: call.id, content: [text(labelled), ...images], ...(outcome.isError ? { is_error: true } : {}) });
        if (outcome.finished) {
          const f = outcome.finished;
          finished = this.deliver(f.page, f.title ?? "", f.summary, f.files);
        }
      }
      if (finished) {
        this.owed = results;
        return finished;
      }

      const remaining = maxTurns - turn;
      const note: TextBlock[] = [];
      if (remaining === 5) note.push(text("[studio] 5 tool rounds left. Wrap up: fix only what matters most, then call finish."));
      if (remaining <= 0) {
        if (finalCall) {
          const fallback = newestPage(vfs, workDir);
          this.owed = results;
          if (fallback) {
            onEvent({ type: "notice", text: "已达到轮数上限，交付当前最新的页面。" });
            return this.deliver(fallback, "", "", []);
          }
          throw new Error("The round budget ran out before a page was built.");
        }
        finalCall = true;
        note.push(text("[studio] The round budget is used up. Call finish now with the best page you have."));
      }
      this.messages.push({ role: "user", content: [...results, ...note] });
    }
  }
}

export function runAgent(job: JobOptions, settings: ProviderSettings, env: AgentEnv, onEvent: (event: AgentEvent) => void, signal: AbortSignal): Promise<AgentResult> {
  return new AgentSession(job, settings, env).run(onEvent, signal);
}
