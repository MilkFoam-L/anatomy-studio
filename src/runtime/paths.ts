// POSIX path helpers for the virtual file system. The skill's root is mounted at ROOT,
// so `node examples/x/build.mjs` sees the same layout it would on disk.
export const ROOT = "/anatomy";

export function normalize(path: string): string {
  const absolute = path.startsWith("/");
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!absolute) parts.push("..");
    } else parts.push(part);
  }
  const joined = parts.join("/");
  return absolute ? `/${joined}` : joined || ".";
}

export function join(...parts: string[]): string {
  return normalize(parts.filter(Boolean).join("/"));
}

export function resolve(cwd: string, ...paths: string[]): string {
  let out = cwd;
  for (const path of paths) out = path.startsWith("/") ? path : `${out}/${path}`;
  return normalize(out);
}

export function dirname(path: string): string {
  const clean = normalize(path);
  const at = clean.lastIndexOf("/");
  if (at < 0) return ".";
  return at === 0 ? "/" : clean.slice(0, at);
}

export function basename(path: string, ext?: string): string {
  const base = normalize(path).split("/").pop() ?? "";
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

export function extname(path: string): string {
  const base = basename(path);
  const at = base.lastIndexOf(".");
  return at > 0 ? base.slice(at) : "";
}

export function relative(from: string, to: string): string {
  const a = normalize(from).split("/").filter(Boolean);
  const b = normalize(to).split("/").filter(Boolean);
  let same = 0;
  while (same < a.length && same < b.length && a[same] === b[same]) same++;
  return [...Array(a.length - same).fill(".."), ...b.slice(same)].join("/");
}

/** Absolute path → key in the file map ("kit/iso-kit.mjs"), or null when outside the root. */
export function keyOf(absolute: string): string | null {
  const clean = normalize(absolute);
  if (clean === ROOT) return "";
  return clean.startsWith(`${ROOT}/`) ? clean.slice(ROOT.length + 1) : null;
}

/** Resolves a path the model or a script gave (relative to cwd, or absolute) to a key. */
export function keyFrom(cwd: string, path: string): string | null {
  return keyOf(resolve(cwd, path.replace(/^file:\/\//, "")));
}
