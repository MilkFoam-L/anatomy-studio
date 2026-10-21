import { describe, expect, it } from "vitest";
import { builtinOf, rewriteModule, specifiersOf } from "../../src/runtime/modules";
import { relative, resolve } from "../../src/runtime/paths";

const source = `import { writeFileSync } from "node:fs";
import * as k from "../../kit/iso-kit.mjs";
import {
  a,
  b as c,
} from './parts.mjs';
export * from "./more.mjs";
const lazy = await import("./lazy.mjs");
const here = import.meta.url;`;

describe("module rewriting", () => {
  it("finds static, multi-line, re-export and dynamic specifiers", () => {
    expect(specifiersOf(source)).toEqual(["node:fs", "../../kit/iso-kit.mjs", "./parts.mjs", "./more.mjs", "./lazy.mjs"]);
  });

  it("maps specifiers and pins import.meta.url to the virtual file", () => {
    const out = rewriteModule(source, "/anatomy/work/x/build.mjs", (s) => (s === "node:fs" ? null : `blob:${s}`));
    expect(out).toContain(`from "node:fs"`);
    expect(out).toContain(`from "blob:../../kit/iso-kit.mjs"`);
    expect(out).toContain(`from 'blob:./parts.mjs'`);
    expect(out).toContain(`import("blob:./lazy.mjs")`);
    expect(out).toContain(`const here = "file:///anatomy/work/x/build.mjs"`);
  });

  it("recognises node built-ins with and without the node: prefix", () => {
    expect(builtinOf("node:path")).toBe("path");
    expect(builtinOf("fs")).toBe("fs");
    expect(builtinOf("react")).toBeNull();
  });

  it("resolves paths like POSIX", () => {
    expect(resolve("/anatomy/work/x", "../../kit/iso-kit.mjs")).toBe("/anatomy/kit/iso-kit.mjs");
    expect(relative("/anatomy/work/x", "/anatomy/kit/a.mjs")).toBe("../../kit/a.mjs");
  });
});
