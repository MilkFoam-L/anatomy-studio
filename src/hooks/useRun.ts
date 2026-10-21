import { useCallback, useEffect, useReducer, useRef } from "react";
import { AgentSession, type AgentEvent, type AgentResult } from "../agent/loop";
import { QUALITY, type JobOptions } from "../agent/prompt";
import { getEngine } from "../lib/engine";
import { saveEntry, type HistoryEntry } from "../lib/history";
import { bytesToObjectUrl, thumbnail } from "../lib/images";
import { isAbort } from "../llm/client";
import { emptyUsage, type ProviderSettings, type Usage } from "../llm/types";

export type ToolStatus = "writing" | "running" | "done" | "error";

export type LogItem =
  | { kind: "text"; id: string; text: string }
  | { kind: "thinking"; id: string; text: string }
  | { kind: "tool"; id: string; name: string; input?: Record<string, unknown>; bytes: number; status: ToolStatus; output?: string; shots: Shot[] }
  | { kind: "notice"; id: string; text: string; tone: "info" | "warn" };

export interface Shot {
  key: string;
  url: string;
}

export type RunStatus = "idle" | "starting" | "running" | "done" | "error" | "stopped";

export interface RunState {
  status: RunStatus;
  job: JobOptions | null;
  items: LogItem[];
  turn: number;
  maxTurns: number;
  usage: Usage;
  result: AgentResult | null;
  error: string | null;
  startedAt: number;
  finishedAt: number;
  lastShot: Shot | null;
  historyId: string | null;
  /** When the current model call started, while nothing of its reply has arrived yet. */
  waitingSince: number | null;
  /** Log length when the current model call started; a retry drops what it had streamed. */
  turnItemStart: number;
}

type Queued = { event: AgentEvent; shots?: Shot[] };

type Action =
  | { type: "start"; job: JobOptions }
  | { type: "revise"; note: string; maxTurns: number }
  | { type: "events"; events: Queued[] }
  | { type: "done"; result: AgentResult; historyId: string }
  | { type: "fail"; error: string; stopped: boolean; partial: AgentResult | null }
  | { type: "load"; entry: HistoryEntry };

const initial: RunState = { status: "idle", job: null, items: [], turn: 0, maxTurns: 0, usage: emptyUsage(), result: null, error: null, startedAt: 0, finishedAt: 0, lastShot: null, historyId: null, waitingSince: null, turnItemStart: 0 };

let seq = 0;
const nextId = () => `i${++seq}`;

function withItem(items: LogItem[], id: string, update: (item: LogItem) => LogItem): LogItem[] {
  return items.map((item) => (item.id === id ? update(item) : item));
}

function reduce(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "start":
      return { ...initial, status: "starting", job: action.job, maxTurns: QUALITY[action.job.quality].rounds, startedAt: Date.now() };
    case "revise":
      return {
        ...state,
        status: "running",
        result: null,
        error: null,
        turn: 0,
        maxTurns: action.maxTurns,
        startedAt: Date.now(),
        items: [...state.items, { kind: "notice", id: nextId(), tone: "info", text: `修改意见：${action.note}` }],
      };
    case "done":
      return { ...state, status: "done", result: action.result, error: null, finishedAt: Date.now(), historyId: action.historyId, waitingSince: null };
    case "fail":
      return { ...state, status: action.stopped ? "stopped" : "error", error: action.error, result: action.partial, finishedAt: Date.now(), waitingSince: null };
    case "load": {
      const e = action.entry;
      const result: AgentResult = { page: e.page, html: e.html, title: e.title, summary: e.summary, files: e.files, usage: e.usage, turns: e.turns };
      return { ...initial, status: "done", job: e.job, result, usage: e.usage, turn: e.turns, maxTurns: QUALITY[e.job.quality].rounds, startedAt: e.createdAt - (e.durationMs ?? 0), finishedAt: e.createdAt, historyId: e.id };
    }
    case "events":
      return action.events.reduce((next, { event, shots }) => applyEvent(next, event, shots ?? []), state);
  }
}

function applyEvent(prev: RunState, event: AgentEvent, shots: Shot[]): RunState {
  const arrived = event.type === "text" || event.type === "thinking" || event.type === "tool_start" || event.type === "tool_call";
  const state = arrived && prev.waitingSince !== null ? { ...prev, waitingSince: null } : prev;
  const items = state.items;
  const last = items[items.length - 1];
  switch (event.type) {
    case "turn":
      return { ...state, status: "running", turn: event.turn, maxTurns: event.maxTurns, waitingSince: Date.now(), turnItemStart: items.length };
    case "text":
      if (last?.kind === "text") return { ...state, items: [...items.slice(0, -1), { ...last, text: last.text + event.text }] };
      return { ...state, items: [...items, { kind: "text", id: nextId(), text: event.text }] };
    case "thinking":
      if (last?.kind === "thinking") return { ...state, items: [...items.slice(0, -1), { ...last, text: last.text + event.text }] };
      return { ...state, items: [...items, { kind: "thinking", id: nextId(), text: event.text }] };
    case "tool_start":
      return { ...state, items: [...items, { kind: "tool", id: event.id || nextId(), name: event.name, bytes: 0, status: "writing", shots: [] }] };
    case "tool_progress":
      return { ...state, items: withItem(items, event.id, (item) => (item.kind === "tool" ? { ...item, bytes: event.bytes } : item)) };
    case "tool_call": {
      const exists = items.some((item) => item.id === event.id);
      const item: LogItem = { kind: "tool", id: event.id, name: event.name, input: event.input, bytes: 0, status: "running", shots: [] };
      return { ...state, items: exists ? withItem(items, event.id, (old) => (old.kind === "tool" ? { ...old, input: event.input, status: "running" } : old)) : [...items, item] };
    }
    case "tool_result":
      return {
        ...state,
        lastShot: shots.length ? shots[shots.length - 1] : state.lastShot,
        items: withItem(items, event.id, (item) => (item.kind === "tool" ? { ...item, status: event.isError ? "error" : "done", output: event.text, shots } : item)),
      };
    case "usage":
      return { ...state, usage: event.usage };
    case "retry": {
      const kept = items.slice(0, state.turnItemStart);
      const notice: LogItem = { kind: "notice", id: nextId(), tone: "warn", text: `接口暂时失败（${event.message.slice(0, 120)}），${Math.round(event.waitMs / 1000)} 秒后第 ${event.attempt} 次重试` };
      return { ...state, items: [...kept, notice], turnItemStart: kept.length + 1, waitingSince: Date.now() + event.waitMs };
    }
    case "notice":
      return { ...state, items: [...items, { kind: "notice", id: nextId(), tone: "info", text: event.text }] };
  }
}

export interface Delivered {
  entry: HistoryEntry;
  /** False when the browser refused to store it (quota, private mode). */
  saved: boolean;
}

export function useRun() {
  const [state, dispatch] = useReducer(reduce, initial);
  const controller = useRef<AbortController | null>(null);
  const session = useRef<AgentSession | null>(null);
  /** Bumped by every start, revision and history load; older legs then go quiet. */
  const leg = useRef(0);
  const urls = useRef<string[]>([]);
  // Streamed events arrive by the hundred when a relay releases a buffered reply; they are
  // applied once per frame so the page renders at most once per frame, not once per token.
  const queue = useRef<Queued[]>([]);
  const frame = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      clearTimeout(frame.current);
      frame.current = null;
    }
    if (!queue.current.length) return;
    const events = queue.current;
    queue.current = [];
    dispatch({ type: "events", events });
  }, []);
  const enqueue = useCallback((item: Queued) => {
    queue.current.push(item);
    if (frame.current !== null) return;
    // rAF does not fire in a background tab; the timeout keeps the log moving there.
    frame.current = document.hidden ? window.setTimeout(flush, 250) : requestAnimationFrame(flush);
  }, [flush]);
  const lastBytes = useRef<Uint8Array | null>(null);

  const releaseUrls = () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
  };
  useEffect(() => () => {
    controller.current?.abort();
    releaseUrls();
  }, []);

  const begin = () => {
    controller.current?.abort();
    controller.current = null;
    // Events still queued belong to the leg being left.
    queue.current = [];
    return ++leg.current;
  };

  /** Runs one leg of a session and files the result in history. */
  const drive = useCallback(async (id: number, current: AgentSession, work: (signal: AbortSignal, onEvent: (event: AgentEvent) => void) => Promise<AgentResult>): Promise<Delivered | null> => {
    const { job, model } = current;
    const live = () => leg.current === id;
    const send = (action: Action) => {
      if (!live()) return;
      flush();
      dispatch(action);
    };
    const onEvent = (event: AgentEvent) => {
      if (!live()) return;
      if (event.type === "tool_result" && event.images.length) {
        const shots = event.images.map((image) => {
          const url = bytesToObjectUrl(image.bytes);
          urls.current.push(url);
          return { key: image.key, url };
        });
        lastBytes.current = event.images[event.images.length - 1].bytes;
        enqueue({ event, shots });
      } else enqueue({ event });
    };
    const abort = new AbortController();
    controller.current = abort;
    const startedAt = Date.now();
    const file = async (result: AgentResult, unfinished: boolean): Promise<Delivered> => {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        job,
        title: unfinished ? `未完成 · ${result.title || job.prompt.slice(0, 40)}` : result.title,
        summary: result.summary,
        page: result.page,
        html: result.html,
        files: result.files,
        thumbnail: lastBytes.current ? await thumbnail(lastBytes.current).catch(() => null) : null,
        usage: result.usage,
        turns: result.turns,
        model,
        durationMs: Date.now() - startedAt,
      };
      const saved = await saveEntry(entry).then(() => true, () => false);
      return { entry, saved };
    };
    try {
      const result = await work(abort.signal, onEvent);
      if (!live()) return null;
      const delivered = await file(result, false);
      send({ type: "done", result, historyId: delivered.saved ? delivered.entry.id : "" });
      return delivered;
    } catch (error) {
      const stopped = isAbort(error) || abort.signal.aborted;
      // Whatever page exists is kept: shown, downloadable, and filed as unfinished.
      const partial = current.snapshot();
      if (partial && live()) await file(partial, true);
      send({ type: "fail", error: stopped ? "已停止" : error instanceof Error ? error.message : String(error), stopped, partial });
      return null;
    } finally {
      if (controller.current === abort) controller.current = null;
      // The last checked page would otherwise keep animating off to the side.
      if (live()) getEngine().then((engine) => engine.stage.clear()).catch(() => undefined);
    }
  }, [enqueue, flush]);

  const start = useCallback(async (job: JobOptions, settings: ProviderSettings) => {
    const id = begin();
    releaseUrls();
    lastBytes.current = null;
    session.current = null;
    dispatch({ type: "start", job });
    let current: AgentSession;
    try {
      const engine = await getEngine();
      current = new AgentSession(job, settings, { skillFiles: engine.skill.files, node: engine.node, stage: engine.stage });
    } catch (error) {
      if (leg.current === id) dispatch({ type: "fail", error: `运行环境加载失败：${error instanceof Error ? error.message : String(error)}`, stopped: false, partial: null });
      return null;
    }
    if (leg.current !== id) return null;
    session.current = current;
    return drive(id, current, (signal, onEvent) => current.run(onEvent, signal));
  }, [drive]);

  /** Sends revision notes to the session that made the current figure. */
  const revise = useCallback(async (note: string) => {
    const current = session.current;
    if (!current || controller.current) return null;
    const id = begin();
    dispatch({ type: "revise", note, maxTurns: Math.max(15, Math.round(QUALITY[current.job.quality].rounds / 2)) });
    return drive(id, current, (signal, onEvent) => current.followUp(note, onEvent, signal));
  }, [drive]);

  const stop = useCallback(() => controller.current?.abort(), []);
  const load = useCallback((entry: HistoryEntry) => {
    begin();
    session.current = null;
    releaseUrls();
    dispatch({ type: "load", entry });
  }, []);

  const canRevise = session.current !== null && (state.status === "done" || state.status === "stopped" || state.status === "error");
  return { state, start, stop, load, revise, canRevise };
}
