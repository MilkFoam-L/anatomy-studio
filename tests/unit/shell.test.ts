import { describe, expect, it } from "vitest";
import { parseCommand } from "../../src/runtime/shell";

describe("parseCommand", () => {
  it("splits && chains and keeps quoted JSON intact", () => {
    const { steps } = parseCommand(`cd examples/x && node scripts/drive.mjs page.html '[["wait",1500],["shot","a.png"]]'`);
    expect(steps.map((s) => s.pipeline[0].argv)).toEqual([
      ["cd", "examples/x"],
      ["node", "scripts/drive.mjs", "page.html", `[["wait",1500],["shot","a.png"]]`],
    ]);
    expect(steps[1].after).toBe("&&");
  });

  it("reads redirects, 2>&1 and a trailing & as background", () => {
    const { steps, background } = parseCommand("node build.mjs --audit > audit.txt 2>&1 &");
    expect(background).toBe(true);
    expect(steps[0].pipeline[0]).toEqual({ argv: ["node", "build.mjs", "--audit"], redirect: "audit.txt" });
  });

  it("builds pipelines", () => {
    const { steps } = parseCommand(`grep -n "export function" kit/iso-kit.mjs | head -5`);
    expect(steps[0].pipeline.map((c) => c.argv[0])).toEqual(["grep", "head"]);
    expect(steps[0].pipeline[0].argv[2]).toBe("export function");
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCommand(`echo "oops`)).toThrow(/Unclosed quote/);
  });
});

describe("parseCommand operators", () => {
  it("keeps quoted operators as words", () => {
    const { steps } = parseCommand(`grep -n "&&" build.mjs | grep -c ">"`);
    expect(steps).toHaveLength(1);
    expect(steps[0].pipeline.map((c) => c.argv)).toEqual([["grep", "-n", "&&", "build.mjs"], ["grep", "-c", ">"]]);
  });

  it("marks >> as an append redirect", () => {
    const { steps } = parseCommand("echo hi >> notes.md");
    expect(steps[0].pipeline[0]).toEqual({ argv: ["echo", "hi"], redirect: "notes.md", append: true });
  });
});

describe("parseCommand scripts", () => {
  it("feeds a here-document to its command and keeps the rest of the line", () => {
    const { steps } = parseCommand(`cat > work/a.mjs <<'EOF'\nconst a = "x && y";\nEOF\nnode work/a.mjs`);
    expect(steps).toHaveLength(2);
    expect(steps[0].pipeline[0]).toEqual({ argv: ["cat"], redirect: "work/a.mjs", stdin: 'const a = "x && y";\n' });
    expect(steps[1].pipeline[0].argv).toEqual(["node", "work/a.mjs"]);
  });

  it("treats newlines outside quotes as separate commands", () => {
    const { steps } = parseCommand("cd work\nls");
    expect(steps.map((s) => s.pipeline[0].argv[0])).toEqual(["cd", "ls"]);
  });
});
