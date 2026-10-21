import { keyFrom, ROOT } from "./paths";

export type FileData = string | Uint8Array;

/** In-memory file system: the read-only skill bundle plus everything the run writes. */
export class Vfs {
  private readonly files = new Map<string, FileData>();
  private readonly base = new Set<string>();
  private readonly touched = new Set<string>();

  constructor(skill: Record<string, string> = {}) {
    for (const [key, text] of Object.entries(skill)) {
      this.files.set(key, text);
      this.base.add(key);
    }
  }

  key(path: string, cwd = ROOT): string {
    const key = keyFrom(cwd, path);
    if (key === null || key === "") throw new Error(`Path is outside the workspace: ${path}`);
    return key;
  }

  has(key: string): boolean {
    return this.files.has(key);
  }

  get(key: string): FileData | undefined {
    return this.files.get(key);
  }

  text(key: string): string {
    const data = this.files.get(key);
    if (data === undefined) throw new Error(`No such file: ${key}`);
    return typeof data === "string" ? data : new TextDecoder().decode(data);
  }

  write(key: string, data: FileData): void {
    this.files.set(key, data);
    // Re-adding keeps the set in last-write order, which recent() relies on.
    this.touched.delete(key);
    this.touched.add(key);
  }

  remove(key: string): boolean {
    this.touched.delete(key);
    return this.files.delete(key);
  }

  isDir(key: string): boolean {
    const prefix = key ? `${key}/` : "";
    for (const name of this.files.keys()) if (name.startsWith(prefix)) return true;
    return false;
  }

  /** Immediate children of a directory key: files and sub-directories (with a trailing slash). */
  list(key: string): string[] {
    const prefix = key ? `${key}/` : "";
    const out = new Set<string>();
    for (const name of this.files.keys()) {
      if (!name.startsWith(prefix)) continue;
      const rest = name.slice(prefix.length);
      const slash = rest.indexOf("/");
      out.add(slash < 0 ? rest : `${rest.slice(0, slash)}/`);
    }
    return [...out].sort();
  }

  /** Every key the run wrote, whether new or an edited skill file. */
  changed(): string[] {
    return [...this.touched].filter((key) => this.files.has(key)).sort();
  }

  /** Written keys, least recently written first. */
  recent(): string[] {
    return [...this.touched].filter((key) => this.files.has(key));
  }

  isSkillFile(key: string): boolean {
    return this.base.has(key);
  }

  textFiles(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, data] of this.files) if (typeof data === "string") out[key] = data;
    return out;
  }
}
