// No horizontal overflow at common widths, idle and while a (scripted) run is checking a page.
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [320, 390, 768, 1440];

async function scriptedRun(page: Page) {
  let calls = 0;
  await page.route("https://mock.test/v1/messages", async (route) => {
    if (++calls > 1) return; // the second turn never answers: the run stays "in progress"
    const input = { command: "node examples/dial-indicator/build.mjs --light && node scripts/capture.mjs examples/dial-indicator/dial-indicator-light.html --out work/a.png --scale 1" };
    const events = [
      { type: "message_start", message: { usage: { input_tokens: 9000, output_tokens: 1 } } },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "run", input: {} } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 300 } },
    ];
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("") });
  });
  await page.evaluate(() => {
    localStorage.setItem("anatomy-studio.settings", JSON.stringify({ baseUrl: "https://mock.test", model: "mock", protocol: "anthropic", maxTokens: 32000 }));
    sessionStorage.setItem("anatomy-studio.apiKey", "sk-x");
  });
  await page.reload();
  await page.getByLabel(/说出你想讲清楚的概念/).fill("解释表盘指示器");
  await page.getByRole("button", { name: /生成图解/ }).click();
  await expect(page.getByAltText("最近一张检查截图")).toBeVisible({ timeout: 60_000 });
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
/** The widest elements past the right edge, to name the culprit in a failure. */
const offenders = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 0.5)
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class")).slice(0, 80)} → ${Math.round(el.getBoundingClientRect().right)}px`)
      .join("\n"),
  );

for (const width of WIDTHS) {
  test(`no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(await overflow(page), await offenders(page)).toBeLessThanOrEqual(0);
    await scriptedRun(page);
    expect(await overflow(page), await offenders(page)).toBeLessThanOrEqual(0);
    if (process.env.LAYOUT_SHOTS) await page.locator("#workbench").screenshot({ path: `${process.env.LAYOUT_SHOTS}/running-${width}.png` });
  });
}
