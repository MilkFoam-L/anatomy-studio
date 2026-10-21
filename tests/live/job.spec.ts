// Live run against a real endpoint. Not part of the default suite; needs:
//   ANATOMY_BASE_URL, ANATOMY_API_KEY, ANATOMY_MODEL (optional), ANATOMY_OUT (optional dir)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test("a real job builds and delivers a figure", async ({ page }) => {
  test.setTimeout(60 * 60 * 1000);
  const baseUrl = process.env.ANATOMY_BASE_URL;
  const apiKey = process.env.ANATOMY_API_KEY;
  test.skip(!baseUrl || !apiKey, "set ANATOMY_BASE_URL and ANATOMY_API_KEY");
  const out = process.env.ANATOMY_OUT ?? "test-results/live";
  mkdirSync(out, { recursive: true });
  await page.goto("/tests/harness/");
  const timer = setInterval(async () => {
    const log = await page.evaluate(() => (window as unknown as { jobLog?: string[] }).jobLog ?? []).catch(() => []);
    writeFileSync(join(out, "log.txt"), log.join("\n"));
  }, 5000);
  const result = await page.evaluate(
    async ([settings, prompt]) => (await (window as any).harness).job({ prompt, theme: "light", output: "html", quality: "quick" }, settings),
    [{ protocol: "anthropic", baseUrl, apiKey, model: process.env.ANATOMY_MODEL ?? "claude-opus-5-5", maxTokens: 32000 }, process.env.ANATOMY_PROMPT ?? "用一个等距机械图解释令牌桶限流：桶容量 20，每秒补充 5 个令牌，每个请求消耗 1 个，桶空时拒绝请求。"] as const,
  );
  clearInterval(timer);
  writeFileSync(join(out, "log.txt"), result.log.join("\n"));
  if (result.html) writeFileSync(join(out, "figure.html"), result.html);
  writeFileSync(join(out, "result.json"), JSON.stringify({ ...result, html: undefined, log: undefined }, null, 2));
  expect(result.ok, result.error).toBe(true);
});
