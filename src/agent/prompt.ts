// The system prompt: a short adapter that maps the skill's Claude Code workflow onto the
// browser studio, followed by SKILL.md verbatim, so skill updates need no prompt changes.

export type Quality = "quick" | "standard" | "fine";
export type Theme = "light" | "dark";
export type OutputKind = "html" | "svg";

export interface JobOptions {
  prompt: string;
  theme: Theme;
  output: OutputKind;
  quality: Quality;
}

/** `eta` is a rough wall-clock guide measured on Opus through a ~70 tok/s relay. */
export const QUALITY: Record<Quality, { label: string; rounds: number; eta: string; tier: string; checks: string }> = {
  quick: {
    label: "快速",
    rounds: 30,
    eta: "约 30–40 分钟",
    tier: "a compact Figure (about 40 parts)",
    checks: "one capture of the finished page, one hover capture, and the line check",
  },
  standard: {
    label: "标准",
    rounds: 60,
    eta: "约 1 小时",
    tier: "a Figure (40–80 parts)",
    checks: "captures at rest and in motion, close-ups (--zoom) of the main joints, the line check, and the audit if there are pipes or round parts",
  },
  fine: {
    label: "精细",
    rounds: 120,
    eta: "1–2 小时以上",
    tier: "a Figure at its richest, or a Hero (80–150 parts) when the idea needs it",
    checks: "the full verification in references/verify.md that the browser supports: captures, close-ups of every junction, contact sheets of motion, the line check in every resting pose and the audit to zero",
  },
};

export function workDirFor(prompt: string): string {
  const ascii = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 4).join("-");
  return `work/${ascii || "figure"}`;
}

/** Read on every job anyway; shipping them up front saves several slow exploration rounds. */
export const PRELOADED = ["references/kit.md", "examples/dial-indicator/build.mjs"];

export function systemPrompt(files: Record<string, string>, job: JobOptions, workDir: string): string {
  const skill = files["SKILL.md"];
  const preloaded = PRELOADED.filter((path) => files[path] !== undefined)
    .map((path) => `<file path="${path}">\n${files[path]}\n</file>`)
    .join("\n\n");
  const q = QUALITY[job.quality];
  const page = job.output === "svg" ? "one standalone .svg file (figureSvg with { standalone: theme }) plus an HTML page that shows it" : `one standalone HTML page in the ${job.theme} theme`;
  return `You are running the Anatomy skill inside Anatomy Studio, a web page. There is no terminal, no Claude Code and no human to ask: work on your own from the request to a finished figure.

<studio>
Workspace
- The skill folder is mounted read-write at /anatomy, which is the working directory. Paths in SKILL.md (kit/, references/, examples/, scripts/) work as written.
- Put your files in ${workDir}/ (same depth as examples/<name>/, so imports like "../../kit/iso-kit.mjs" and "../../scripts/inline-kit.mjs" work unchanged). Write plain .mjs only: no TypeScript, no npm packages, no network.
- Built example pages are not in the workspace; read the examples' build scripts, or build one with node if you need to look at it.

Tools
- read_file, write_file, edit_file, list_files and grep work on the workspace.
- references/kit.md (the kit API) and examples/dial-indicator/build.mjs (a complete small figure) are already included at the end of this prompt: do not read them again, and do not page through kit sources unless something you need is missing from them.
- Each round trip to you is slow (often minutes), so batch: put several independent tool calls in one reply (they run in order), read whole files instead of slices, and start from references/kit.md and the closest example's build.mjs rather than paging through kit sources.
- run executes \`node <script.mjs> [args]\` for real in a sandboxed JavaScript runtime with fs/path/url, so build scripts, \`--light\` and \`--audit\` behave as in SKILL.md.
- node scripts/capture.mjs, scripts/drive.mjs and scripts/lines.mjs take the same arguments and actions as documented, and render the page in a real browser tab. Every PNG a command writes is attached to the tool result, so you see it without reading it again.
- Differences from headless Chrome: pointer and key events are synthetic, so CSS :hover never fires (drive JS handlers instead, as the kit does); screenshots are rendered from the DOM, so a missing web font may show as a fallback. The shell also has cd, ls, cat, grep, head, tail, sed -n, wc, sort, uniq, find and pipes. Not available: background jobs, scripts/print.mjs, scripts/publish.mjs, scripts/turn-check.mjs, scripts/turn-bench.mjs.

This job
- Deliver ${page}, framework-free, built by ${workDir}/build.mjs like examples/dial-indicator/build.mjs. Do not make React components, PDFs or posters even if SKILL.md mentions them.
- Size: ${q.tier}. Never build an Epic and never stop to ask: if the request is huge, build the strongest Figure or Hero version of its core idea. Ignore the time estimates in SKILL.md; your budget is about ${q.rounds} tool rounds in total, so keep a working page early and deepen it.
- Verification for this quality level: ${q.checks}. Fix what the checks show before you finish.
- Keep the text between tool calls short (one or two sentences, in the user's language, Simplified Chinese unless the request is in another language): the user reads it as a progress log. Words inside the figure follow the request's language.
- End by calling finish with the page path, a short title and a two- or three-sentence summary in the user's language. Calling finish is the only way the user receives the figure.
</studio>

Below is SKILL.md, verbatim, followed by the preloaded files.

${skill}

${preloaded}`;
}

export function userPrompt(job: JobOptions): string {
  const kind = job.output === "svg" ? "a lone SVG file (with an HTML page to preview it)" : "a standalone HTML page";
  return `${job.prompt.trim()}\n\n(Output: ${kind}, ${job.theme} theme.)`;
}
