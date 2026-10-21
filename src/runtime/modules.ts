// Rewrites ES module specifiers so a graph of files from the virtual file system can be
// loaded from blob: URLs, which cannot resolve relative imports on their own.

const STATIC_IMPORT = /(\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?|\bexport\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*)(["'])([^"'\n]+)\2/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g;

export const NODE_BUILTINS = ["fs", "path", "url", "process", "buffer", "os", "child_process", "fs/promises", "perf_hooks", "util"];

export function builtinOf(specifier: string): string | null {
  const name = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  return NODE_BUILTINS.includes(name) ? name : null;
}

/** Every module specifier in the source, static and literal dynamic imports. */
export function specifiersOf(source: string): string[] {
  const out = new Set<string>();
  for (const match of source.matchAll(STATIC_IMPORT)) out.add(match[3]);
  for (const match of source.matchAll(DYNAMIC_IMPORT)) out.add(match[2]);
  return [...out];
}

/**
 * Replaces each specifier with what `map` returns (left unchanged on null), and
 * `import.meta.url` / `dirname` / `filename` with the module's virtual file location.
 */
export function rewriteModule(source: string, absolutePath: string, map: (specifier: string) => string | null): string {
  const fileUrl = `file://${absolutePath}`;
  const dir = absolutePath.slice(0, absolutePath.lastIndexOf("/")) || "/";
  return source
    .replace(STATIC_IMPORT, (whole, head: string, quote: string, specifier: string) => {
      const target = map(specifier);
      return target === null ? whole : `${head}${quote}${target}${quote}`;
    })
    .replace(DYNAMIC_IMPORT, (whole, quote: string, specifier: string) => {
      const target = map(specifier);
      return target === null ? whole : `import(${quote}${target}${quote})`;
    })
    .replace(/\bimport\.meta\.url\b/g, JSON.stringify(fileUrl))
    .replace(/\bimport\.meta\.dirname\b/g, JSON.stringify(dir))
    .replace(/\bimport\.meta\.filename\b/g, JSON.stringify(absolutePath));
}
