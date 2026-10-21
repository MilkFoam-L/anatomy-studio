// A tiny shell-words parser for the commands models habitually write, e.g.
//   cd examples/x && node build.mjs --light --audit > audit.txt 2>&1 &
//   node scripts/drive.mjs page.html '[["wait",1500],["shot","a.png"]]'
//   grep -n "export function" kit/iso-kit.mjs | head -40

export interface SimpleCommand {
  argv: string[];
  /** File that stdout (and stderr with 2>&1) is redirected to. */
  redirect?: string;
  /** `>>`: append to the file instead of replacing it. */
  append?: boolean;
  /** Body of a `<<EOF` here-document, fed to the command as stdin. */
  stdin?: string;
}

export interface Step {
  /** Commands joined by pipes; each one's output is the next one's input. */
  pipeline: SimpleCommand[];
  /** How this step relates to the previous one. */
  after: "&&" | ";" | "||";
}

export interface CommandList {
  steps: Step[];
  background: boolean;
}

type Token = { op: string } | { word: string } | { heredoc: number };

const HEREDOC = /<<-?[ \t]*(['"]?)([A-Za-z_][\w-]*)\1/g;

/** Cuts here-document bodies out of the script, leaving `<<n` markers on the command lines. */
function extractHeredocs(script: string): { text: string; bodies: string[] } {
  const bodies: string[] = [];
  let text = "";
  let rest = script;
  for (;;) {
    HEREDOC.lastIndex = 0;
    const match = HEREDOC.exec(rest);
    if (!match) break;
    const lineEnd = rest.indexOf("\n", match.index);
    if (lineEnd < 0) break;
    const lines = rest.slice(lineEnd + 1).split("\n");
    const close = lines.findIndex((line) => line.trim() === match[2]);
    const body = close < 0 ? lines : lines.slice(0, close);
    bodies.push(body.join("\n") + "\n");
    text += `${rest.slice(0, match.index)}\u0000${bodies.length - 1}\u0000${rest.slice(match.index + match[0].length, lineEnd)}\n`;
    rest = close < 0 ? "" : lines.slice(close + 1).join("\n");
  }
  return { text: text + rest, bodies };
}

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let current = "";
  let quoted = false;
  let quote: string | null = null;
  const push = () => {
    if (current || quoted) tokens.push({ word: current });
    current = "";
    quoted = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) current += line[++i];
      else current += ch;
      continue;
    }
    if (ch === "\u0000") {
      const end = line.indexOf("\u0000", i + 1);
      push();
      tokens.push({ heredoc: Number(line.slice(i + 1, end)) });
      i = end;
    } else if (ch === "\n") {
      push();
      tokens.push({ op: ";" });
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      quoted = true;
    } else if (ch === "\\" && i + 1 < line.length) current += line[++i];
    else if (/\s/.test(ch)) push();
    else if ((ch === "&" || ch === "|") && line[i + 1] === ch) {
      push();
      tokens.push({ op: ch + ch });
      i++;
    } else if (ch === ";" || ch === "&" || ch === "|") {
      push();
      tokens.push({ op: ch });
    } else if (ch === ">") {
      // A lone digit right before ">" is a file descriptor ("2>&1", "2> err.txt").
      const fd = /^\d$/.test(current) && !quoted ? current : "";
      if (fd) current = "";
      push();
      if (line[i + 1] === "&") {
        tokens.push({ op: `${fd}>&${line[i + 2] ?? ""}` });
        i += 2;
      } else if (line[i + 1] === ">") {
        tokens.push({ op: `${fd}>>` });
        i++;
      } else tokens.push({ op: `${fd}>` });
    } else current += ch;
  }
  if (quote) throw new Error("Unclosed quote in command");
  push();
  return tokens;
}

export function parseCommand(line: string): CommandList {
  const { text, bodies } = extractHeredocs(line.trim());
  const tokens = tokenize(text);
  const steps: Step[] = [];
  let background = false;
  let pipeline: SimpleCommand[] = [];
  let current: SimpleCommand = { argv: [] };
  let after: Step["after"] = ";";
  const endCommand = () => {
    if (current.argv.length) pipeline.push(current);
    current = { argv: [] };
  };
  const endStep = (next: Step["after"]) => {
    endCommand();
    if (pipeline.length) steps.push({ pipeline, after });
    pipeline = [];
    after = next;
  };
  const target = (i: number) => {
    const next = tokens[i];
    return next && "word" in next ? next.word : undefined;
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if ("word" in token) {
      current.argv.push(token.word);
      continue;
    }
    if ("heredoc" in token) {
      current.stdin = bodies[token.heredoc];
      continue;
    }
    const op = token.op;
    if (op === "&&" || op === ";" || op === "||") endStep(op);
    else if (op === "|") endCommand();
    else if (op === "&") {
      background = true;
      endStep(";");
    } else if (op === ">" || op === ">>") {
      current.redirect = target(++i);
      if (op === ">>") current.append = true;
    } else if (/^\d>>?$/.test(op)) i++; // stderr to its own file: it shares stdout here
    // "2>&1", ">&2": nothing to do, both streams are one here.
  }
  endStep(";");
  return { steps, background };
}
