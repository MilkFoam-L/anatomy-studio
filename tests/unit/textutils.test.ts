import { describe, expect, it } from "vitest";
import type { RunContext } from "../../src/runtime/context";
import { ROOT } from "../../src/runtime/paths";
import { grep, head, sed, tail, wc } from "../../src/runtime/textutils";
import { Vfs } from "../../src/runtime/vfs";

const ctx = (files: Record<string, string>): RunContext => ({ vfs: new Vfs(files), cwd: ROOT, node: null as never, stage: null as never, timeoutMs: 1000 });
const kit = ctx({ "kit/a.mjs": "export function one() {}\nconst x = 1;\nexport function two() {}\n", "kit/b.mjs": "export const three = 3;\n", "README.md": "hello\n" });

describe("text tools", () => {
  it("grep -n with context over a file", () => {
    expect(grep(["-n", "-A", "1", "export function one", "kit/a.mjs"], null, kit).output).toBe("1:export function one() {}\n2-const x = 1;");
  });

  it("grep -r over a directory names files and returns exit 1 on no match", () => {
    expect(grep(["-rn", "export", "kit"], null, kit).output.split("\n")).toEqual(["kit/a.mjs:1:export function one() {}", "kit/a.mjs:3:export function two() {}", "kit/b.mjs:1:export const three = 3;"]);
    expect(grep(["nothing", "kit"], null, kit).exitCode).toBe(1);
  });

  it("grep -o reads stdin and supports BRE alternation", () => {
    expect(grep(["-o", "one\\|two"], "one two\nthree", kit).output).toBe("one\ntwo");
  });

  it("head, tail, wc and sed -n ranges", () => {
    const text = "a\nb\nc\nd\n";
    expect(head(["-n", "2"], text, kit).output).toBe("a\nb");
    expect(tail(["-2"], text, kit).output).toBe("c\nd");
    expect(tail(["-n", "+3"], text, kit).output).toBe("c\nd");
    expect(wc(["-l"], text, kit).output).toBe("4");
    expect(sed(["-n", "2,3p"], text, kit).output).toBe("b\nc");
  });
});
