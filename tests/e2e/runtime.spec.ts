import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

type Harness = {
  run: (line: string) => Promise<{ exitCode: number; output: string; images: string[] }>;
  read: (key: string) => string;
  size: (key: string) => number;
};

declare global {
  interface Window {
    harness: Promise<Harness>;
  }
}

function nodeBuild(example: string, flags: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "anatomy-"));
  cpSync("vendor/anatomy", dir, { recursive: true, filter: (src) => !src.includes(".git") });
  execFileSync(process.execPath, [join(dir, "examples", example, "build.mjs"), ...flags], { cwd: dir });
  const suffix = flags.includes("--light") ? "-light" : "";
  return readFileSync(join(dir, "examples", example, `${example}${suffix}.html`), "utf8");
}

test("a skill build script produces the same page in the browser as in Node", async ({ page }) => {
  await page.goto("/tests/harness/");
  const result = await page.evaluate(async () => (await window.harness).run("node examples/dial-indicator/build.mjs --light"));
  expect(result.exitCode, result.output).toBe(0);
  const browser = await page.evaluate(async () => (await window.harness).read("examples/dial-indicator/dial-indicator-light.html"));
  expect(browser).toBe(nodeBuild("dial-indicator", ["--light"]));
});

test("the audit runs in the browser", async ({ page }) => {
  await page.goto("/tests/harness/");
  const result = await page.evaluate(async () => (await window.harness).run("cd examples/arcade-cabinet && node build.mjs --audit"));
  expect(result.output).toContain("audit passed");
  expect(result.exitCode).toBe(0);
});

test("capture, drive and lines produce screenshots of a built page", async ({ page }) => {
  await page.goto("/tests/harness/");
  const capture = await page.evaluate(async () => {
    const h = await window.harness;
    await h.run("node examples/dial-indicator/build.mjs --light");
    return h.run("node scripts/capture.mjs examples/dial-indicator/dial-indicator-light.html --out shots/a.png --hover 0.7,0.5");
  });
  expect(capture.exitCode, capture.output).toBe(0);
  expect(capture.output).toMatch(/clip \d+,\d+ \d+x\d+/);
  expect(await page.evaluate(async () => (await window.harness).size("shots/a.png"))).toBeGreaterThan(20000);

  const drive = await page.evaluate(async () =>
    (await window.harness).run(`node scripts/drive.mjs examples/dial-indicator/dial-indicator-light.html '[["wait",300],["move",null,0.2,0.5],["shot","shots/b.png"],["sheet","shots/c.png",100,4]]'`),
  );
  expect(drive.exitCode, drive.output).toBe(0);
  expect(drive.images).toEqual(["shots/b.png", "shots/c.png"]);

  const lines = await page.evaluate(async () => (await window.harness).run("node scripts/lines.mjs examples/dial-indicator/dial-indicator-light.html --out shots/lines.png"));
  expect(lines.output).toMatch(/line ends: \d+ of \d+ ends/);
});

test("node -e runs from the working directory and errors name real files", async ({ page }) => {
  await page.goto("/tests/harness/");
  const ok = await page.evaluate(async () =>
    (await window.harness).run(`node -e 'const k = await import("./kit/iso-kit.mjs"); console.log(typeof k.fitProjection)'`),
  );
  expect(ok.output.trim()).toBe("function");
  const bad = await page.evaluate(async () => {
    const h = await window.harness;
    return h.run(`mkdir -p work/t && node -e 'import("./kit/iso-kit.mjs").then((k) => k.nope())'`);
  });
  expect(bad.exitCode).toBe(1);
  expect(bad.output).toContain("/anatomy/.studio-eval-");
  expect(bad.output).not.toContain("blob:");
});
