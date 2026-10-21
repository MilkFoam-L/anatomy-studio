// Dev-only page used by the Playwright tests to drive the browser runtime directly.
import { AgentSession, type AgentEvent } from "../../src/agent/loop";
import type { JobOptions } from "../../src/agent/prompt";
import type { ProviderSettings } from "../../src/llm/types";
import { loadNodeWorker, loadSkill, loadStageAgent } from "../../src/lib/assets";
import { runCommand } from "../../src/runtime/commands";
import { NodeRuntime } from "../../src/runtime/node";
import { ROOT } from "../../src/runtime/paths";
import { Vfs } from "../../src/runtime/vfs";
import { Stage } from "../../src/stage/stage";

async function setup() {
  const [skill, worker, agent] = await Promise.all([loadSkill(), loadNodeWorker(), loadStageAgent()]);
  const vfs = new Vfs(skill.files);
  const node = new NodeRuntime(worker);
  const stage = new Stage(agent);
  stage.mount(document.getElementById("stage"));
  const ctx = { vfs, cwd: ROOT, node, stage, timeoutMs: 300000 };
  return {
    job: async (job: JobOptions, settings: ProviderSettings) => {
      const log: string[] = [];
      const onEvent = (event: AgentEvent) => {
        if (event.type === "tool_call") log.push(`> ${event.name} ${JSON.stringify(event.input).slice(0, 300)}`);
        else if (event.type === "tool_result") log.push(`< ${event.isError ? "ERR " : ""}${event.text.slice(0, 600)}${event.images.length ? ` [${event.images.length} img]` : ""}`);
        else if (event.type === "retry" || event.type === "notice") log.push(`! ${JSON.stringify(event)}`);
        else if (event.type === "turn") log.push(`--- turn ${event.turn} @ ${new Date().toISOString().slice(11, 19)}`);
        else if (event.type === "usage") log.push(`  usage in=${event.usage.input} cached=${event.usage.cacheRead} out=${event.usage.output}`);
        else if (event.type === "text") log.push(event.text);
        (window as unknown as { jobLog: string[] }).jobLog = log;
      };
      const session = new AgentSession(job, settings, { skillFiles: skill.files, node, stage });
      const started = Date.now();
      try {
        const result = await session.run(onEvent, new AbortController().signal);
        return { ok: true, log, page: result.page, html: result.html, usage: result.usage, turns: result.turns, summary: result.summary, minutes: (Date.now() - started) / 60000 };
      } catch (error) {
        const partial = session.snapshot();
        return { ok: false, log, error: String(error), page: partial?.page, html: partial?.html, usage: partial?.usage, turns: partial?.turns, minutes: (Date.now() - started) / 60000 };
      }
    },
    run: async (line: string) => (await runCommand(line, ctx)).result,
    read: (key: string) => vfs.text(key),
    base64: (key: string) => {
      const data = vfs.get(key);
      if (!(data instanceof Uint8Array)) return "";
      let binary = "";
      for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    size: (key: string) => {
      const data = vfs.get(key);
      return data === undefined ? -1 : typeof data === "string" ? data.length : data.length;
    },
  };
}

(window as unknown as { harness: ReturnType<typeof setup> }).harness = setup();
