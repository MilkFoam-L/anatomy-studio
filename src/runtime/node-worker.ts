// Runs one `node <script> [args]` inside a Web Worker. It is built as a self-contained
// IIFE (scripts/build-runtime.mjs) and started from a blob URL inside an opaque-origin
// sandbox iframe, so the code it runs can reach neither the API key nor the network.
import { builtinOf, rewriteModule } from "./modules";
import { basename, dirname, extname, join, keyOf, normalize, relative, resolve, ROOT } from "./paths";
import type { FileData } from "./vfs";

export interface RunRequest {
  type: "run";
  files: Record<string, string>;
  cwd: string;
  /** Absolute script path followed by its arguments. */
  argv: string[];
}

export interface RunResult {
  type: "done";
  exitCode: number;
  output: string;
  written: Record<string, FileData>;
  removed: string[];
}

class ExitSignal {
  constructor(readonly code: number) {}
}

const scope = self as unknown as DedicatedWorkerGlobalScope & Record<string, unknown>;

/** blob: URL of each loaded module → its path, so stack traces name real files. */
const blobPaths = new Map<string, string>();
const withPaths = (text: string) => (blobPaths.size ? text.replace(/blob:[^\s):]+(?:\/[0-9a-f-]+)/g, (url) => blobPaths.get(url) ?? url) : text);

function format(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return withPaths(value.stack ?? `${value.name}: ${value.message}`);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

// @ts-expect-error Node's Buffer.from(value, encoding) differs from Uint8Array.from.
class NodeBuffer extends Uint8Array {
  static from(value: string | ArrayLike<number> | ArrayBuffer, encoding = "utf8"): NodeBuffer {
    if (typeof value !== "string") return new NodeBuffer(value instanceof ArrayBuffer ? new Uint8Array(value) : Array.from(value));
    if (encoding === "base64") return new NodeBuffer(Array.from(atob(value), (ch) => ch.charCodeAt(0)));
    return new NodeBuffer(new TextEncoder().encode(value));
  }

  static isBuffer(value: unknown): boolean {
    return value instanceof Uint8Array;
  }

  static byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  }

  static concat(list: Uint8Array[]): NodeBuffer {
    const out = new NodeBuffer(list.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of list) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  override toString(encoding = "utf8"): string {
    if (encoding === "base64") {
      let binary = "";
      for (let i = 0; i < this.length; i += 0x8000) binary += String.fromCharCode(...this.subarray(i, i + 0x8000));
      return btoa(binary);
    }
    return new TextDecoder().decode(this);
  }
}

function run(request: RunRequest): Promise<RunResult> {
  const files = new Map<string, FileData>(Object.entries(request.files));
  const written: Record<string, FileData> = {};
  const removed = new Set<string>();
  const lines: string[] = [];
  let cwd = request.cwd;

  const keyFor = (path: string | URL): string => {
    const text = String(path).replace(/^file:\/\//, "");
    const key = keyOf(resolve(cwd, text));
    if (key === null) throw Object.assign(new Error(`EACCES: outside the workspace, '${text}'`), { code: "EACCES" });
    return key;
  };
  const missing = (path: unknown) => Object.assign(new Error(`ENOENT: no such file or directory, open '${String(path)}'`), { code: "ENOENT" });
  const isDir = (key: string) => {
    const prefix = key ? `${key}/` : "";
    for (const name of files.keys()) if (name.startsWith(prefix)) return true;
    return false;
  };

  const fs = {
    existsSync: (path: string) => {
      const key = keyFor(path);
      return files.has(key) || isDir(key);
    },
    readFileSync: (path: string, options?: string | { encoding?: string }) => {
      const key = keyFor(path);
      const data = files.get(key);
      if (data === undefined) throw missing(path);
      const encoding = typeof options === "string" ? options : options?.encoding;
      if (encoding) return typeof data === "string" ? data : new TextDecoder().decode(data);
      return typeof data === "string" ? NodeBuffer.from(data) : NodeBuffer.from(data);
    },
    writeFileSync: (path: string, data: string | Uint8Array) => {
      const key = keyFor(path);
      const value = typeof data === "string" ? data : new Uint8Array(data);
      files.set(key, value);
      written[key] = value;
      removed.delete(key);
    },
    appendFileSync: (path: string, data: string) => {
      const key = keyFor(path);
      const before = files.get(key);
      fs.writeFileSync(path, (before === undefined ? "" : typeof before === "string" ? before : new TextDecoder().decode(before)) + data);
    },
    mkdirSync: () => undefined,
    readdirSync: (path: string) => {
      const key = keyFor(path);
      const prefix = key ? `${key}/` : "";
      const out = new Set<string>();
      for (const name of files.keys()) if (name.startsWith(prefix)) out.add(name.slice(prefix.length).split("/")[0]);
      if (!out.size) throw missing(path);
      return [...out].sort();
    },
    statSync: (path: string) => {
      const key = keyFor(path);
      const data = files.get(key);
      if (data === undefined && !isDir(key)) throw missing(path);
      const size = data === undefined ? 0 : typeof data === "string" ? new TextEncoder().encode(data).length : data.length;
      return { size, isFile: () => data !== undefined, isDirectory: () => data === undefined, mtimeMs: Date.now() };
    },
    rmSync: (path: string) => {
      const key = keyFor(path);
      for (const name of [...files.keys()]) {
        if (name === key || name.startsWith(`${key}/`)) {
          files.delete(name);
          delete written[name];
          removed.add(name);
        }
      }
    },
    unlinkSync: (path: string) => fs.rmSync(path),
    mkdtempSync: (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`,
  };

  const path = {
    sep: "/",
    delimiter: ":",
    join,
    normalize,
    dirname,
    basename,
    extname,
    relative,
    resolve: (...parts: string[]) => resolve(cwd, ...parts),
    isAbsolute: (p: string) => p.startsWith("/"),
    parse: (p: string) => ({ root: p.startsWith("/") ? "/" : "", dir: dirname(p), base: basename(p), ext: extname(p), name: basename(p, extname(p)) }),
  };
  const url = {
    fileURLToPath: (value: string | URL) => decodeURIComponent(String(value).replace(/^file:\/\//, "")),
    pathToFileURL: (p: string) => new URL(`file://${resolve(cwd, p)}`),
    URL,
  };

  let exitCode = 0;
  const processShim = {
    argv: ["/usr/local/bin/node", ...request.argv],
    execArgv: [] as string[],
    execPath: "/usr/local/bin/node",
    env: { NODE_ENV: "production" } as Record<string, string>,
    platform: "linux",
    version: "v22.0.0",
    versions: { node: "22.0.0" },
    get exitCode() {
      return exitCode;
    },
    set exitCode(value: number) {
      exitCode = Number(value) || 0;
    },
    exit: (code?: number) => {
      throw new ExitSignal(code ?? exitCode);
    },
    cwd: () => cwd,
    chdir: (dir: string) => {
      cwd = resolve(cwd, dir);
    },
    hrtime: Object.assign((start?: [number, number]) => {
      const ns = BigInt(Math.round(performance.now() * 1e6));
      const now: [number, number] = [Number(ns / 1_000_000_000n), Number(ns % 1_000_000_000n)];
      return start ? [now[0] - start[0], now[1] - start[1]] : now;
    }, { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }),
    memoryUsage: () => ({ rss: 0, heapUsed: 0, heapTotal: 0 }),
    stdout: { write: (text: string) => (lines.push(String(text).replace(/\n$/, "")), true), isTTY: false, columns: 120 },
    stderr: { write: (text: string) => (lines.push(String(text).replace(/\n$/, "")), true), isTTY: false },
    on: () => processShim,
    once: () => processShim,
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => fn(...args)),
  };

  const unsupported = (name: string) => new Proxy({}, {
    get: (_target, prop) => {
      if (prop === "__esModule" || prop === "then") return undefined;
      throw new Error(`node:${name}.${String(prop)} is not available in the browser runtime`);
    },
  });
  const builtins: Record<string, Record<string, unknown>> = {
    fs,
    "fs/promises": Object.fromEntries(Object.entries(fs).map(([name, fn]) => [name.replace(/Sync$/, ""), async (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(...args)])),
    path,
    url,
    process: processShim,
    buffer: { Buffer: NodeBuffer },
    os: { tmpdir: () => "/tmp", homedir: () => "/home/user", platform: () => "linux", EOL: "\n", cpus: () => [{}] },
    perf_hooks: { performance },
    util: { inspect: format, format: (...args: unknown[]) => args.map(format).join(" ") },
    child_process: unsupported("child_process"),
  };
  scope.__node = builtins;
  // Snippets written for CommonJS (`node -e "require('fs')…"`) get the same built-ins.
  scope.require = (name: string) => {
    const builtin = builtinOf(name);
    if (builtin && builtins[builtin]) return builtins[builtin];
    throw new Error(`require('${name}') is not available here; use import with the kit's relative paths`);
  };
  scope.process = processShim;
  scope.Buffer = NodeBuffer;
  scope.global = scope;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    console[level] = (...args: unknown[]) => lines.push(args.map(format).join(" "));
  }

  const blobs: string[] = [];
  const builtinUrls = new Map<string, string>();
  const builtinUrl = (name: string): string => {
    const cached = builtinUrls.get(name);
    if (cached) return cached;
    const api = builtins[name];
    const names = name === "child_process" ? [] : Object.keys(api).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key));
    const code = `const m = globalThis.__node[${JSON.stringify(name)}];\nexport default m;\n${names.map((key) => `export const ${key} = m[${JSON.stringify(key)}];`).join("\n")}`;
    const out = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    blobs.push(out);
    builtinUrls.set(name, out);
    return out;
  };

  const loaded = new Map<string, string>();
  const loading = new Set<string>();
  const moduleUrl = (key: string): string => {
    const cached = loaded.get(key);
    if (cached) return cached;
    if (loading.has(key)) throw new Error(`Circular import through ${key} is not supported in the browser runtime`);
    const source = files.get(key);
    if (source === undefined) throw new Error(`Cannot find module '${ROOT}/${key}'`);
    if (/\.(ts|tsx|jsx)$/.test(key)) throw new Error(`${key}: TypeScript/JSX cannot run here; write plain .mjs`);
    loading.add(key);
    const absolute = `${ROOT}/${key}`;
    const text = typeof source === "string" ? source : new TextDecoder().decode(source);
    const map = (specifier: string): string | null => {
      const builtin = builtinOf(specifier);
      if (builtin) return builtinUrl(builtin);
      // Bare package names stay as written: the scan is textual and one may sit inside a
      // generated string; a real import of a package then fails with the browser's error.
      if (!/^(\.{1,2}\/|\/)/.test(specifier)) return null;
      const target = keyOf(resolve(dirname(absolute), specifier));
      return target !== null && files.has(target) ? moduleUrl(target) : null;
    };
    const out = URL.createObjectURL(new Blob([rewriteModule(text, absolute, map)], { type: "text/javascript" }));
    blobs.push(out);
    blobPaths.set(out, absolute);
    loading.delete(key);
    loaded.set(key, out);
    return out;
  };

  return new Promise<RunResult>((done) => {
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      for (const blob of blobs) URL.revokeObjectURL(blob);
      done({ type: "done", exitCode: code, output: lines.join("\n"), written, removed: [...removed] });
    };
    const fail = (error: unknown) => {
      if (error instanceof ExitSignal) return finish(error.code);
      lines.push(format(error));
      finish(1);
    };
    scope.addEventListener("error", (event) => {
      event.preventDefault();
      fail(event.error ?? event.message);
    });
    scope.addEventListener("unhandledrejection", (event) => {
      event.preventDefault();
      fail(event.reason);
    });
    try {
      const entry = keyFor(request.argv[0]);
      import(/* @vite-ignore */ moduleUrl(entry))
        // A short grace lets unawaited promise chains settle, as Node's event loop would.
        .then(() => setTimeout(() => finish(exitCode), 50))
        .catch(fail);
    } catch (error) {
      fail(error);
    }
  });
}

scope.addEventListener("message", (event: MessageEvent<RunRequest>) => {
  if (event.data?.type !== "run") return;
  run(event.data).then((result) => scope.postMessage(result));
});
