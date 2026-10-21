import type { FileData } from "../runtime/vfs";
import { withCsp } from "../stage/stage";

export function download(name: string, data: FileData, type = "text/html"): void {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mimeOf(name: string): string {
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".html")) return "text/html";
  if (name.endsWith(".css")) return "text/css";
  return "text/javascript";
}

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * Opens a figure in a new tab. A blob URL would share the studio's origin (and its stored
 * API key), so the tab is a script-free wrapper around an opaque-origin sandbox iframe.
 */
export function openInTab(html: string, title = "Anatomy figure"): void {
  const wrapper = `<!doctype html><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style><iframe sandbox="allow-scripts" srcdoc="${escapeAttr(withCsp(html))}"></iframe>`;
  const url = URL.createObjectURL(new Blob([wrapper], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60000);
}
