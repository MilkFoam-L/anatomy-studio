// The whole studio against a scripted model: settings → prompt → tool loop (write, build,
// capture, finish) → result → revision. The endpoint is intercepted; no tokens are spent.
import { expect, test, type Route } from "@playwright/test";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

const BUILD = `process.argv.push("--light");\nawait import("../../examples/dial-indicator/build.mjs");\n`;
const PAGE = "examples/dial-indicator/dial-indicator-light.html";

const SCRIPT: Block[][] = [
  [{ type: "text", text: "先写构建脚本。" }, { type: "tool_use", id: "t1", name: "write_file", input: { path: "work/demo/build.mjs", content: BUILD } }],
  [{ type: "tool_use", id: "t2", name: "run", input: { command: "node work/demo/build.mjs" } }],
  [{ type: "tool_use", id: "t3", name: "run", input: { command: `node scripts/capture.mjs ${PAGE} --out work/demo/shots/a.png --scale 1` } }],
  [{ type: "tool_use", id: "t4", name: "finish", input: { page: PAGE, title: "表盘指示器", summary: "用表盘读出量块高度。" } }],
  [{ type: "text", text: "按意见修改。" }, { type: "tool_use", id: "t5", name: "finish", input: { page: PAGE, title: "表盘指示器 v2", summary: "已按意见修改。" } }],
];

function sse(blocks: Block[]): string {
  const events: unknown[] = [{ type: "message_start", message: { usage: { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 500 } } }];
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
    } else {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } });
      const json = JSON.stringify(block.input);
      for (let at = 0; at < json.length; at += 40) events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json.slice(at, at + 40) } });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 200 } });
  events.push({ type: "message_stop" });
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

test("a scripted model drives the studio from prompt to delivered figure and a revision", async ({ page }) => {
  const requests: Array<{ headers: Record<string, string>; body: { messages: unknown[]; system: unknown; tools: unknown[] } }> = [];
  await page.route("https://mock.test/v1/messages", async (route: Route) => {
    const body = route.request().postDataJSON();
    requests.push({ headers: route.request().headers(), body });
    const turn = (body.messages.length - 1) / 2;
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse(SCRIPT[Math.min(turn, SCRIPT.length - 1)]) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "接口设置" }).click();
  await page.getByLabel("接口地址").fill("https://mock.test");
  await page.getByLabel("API Key").fill("sk-test");
  await page.getByLabel("模型").fill("mock-model");
  await page.getByRole("button", { name: "保存" }).click();

  await page.getByLabel(/说出你想讲清楚的概念/).fill("解释表盘指示器怎么读数");
  await page.getByRole("button", { name: /生成图解/ }).click();

  await expect(page.getByText("Fig. 1 · 完成")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("用表盘读出量块高度。")).toBeVisible();
  const figure = page.frameLocator('iframe[title="表盘指示器"]');
  await expect(figure.locator(".iso-plate")).toBeVisible();
  await expect(page.locator("#history").getByText("表盘指示器")).toBeVisible();

  // The relay header contract: x-api-key and Authorization, no anthropic-version.
  expect(requests[0].headers["x-api-key"]).toBe("sk-test");
  expect(requests[0].headers.authorization).toBe("Bearer sk-test");
  expect(requests[0].headers["anthropic-version"]).toBeUndefined();
  // The capture's screenshot went back to the model as an image.
  expect(JSON.stringify(requests[3].body.messages)).toContain('"type":"image"');

  await page.getByLabel("修改意见").fill("把读数改成毫米");
  await page.getByRole("button", { name: "修改", exact: true }).click();
  await expect(page.getByText("已按意见修改。")).toBeVisible({ timeout: 60_000 });
  // The revision carries the finish call's tool result and the note in one user turn.
  const revision = requests[4].body.messages.at(-1) as { content: Array<{ type: string; text?: string }> };
  expect(revision.content[0].type).toBe("tool_result");
  expect(revision.content.at(-1)?.text).toContain("把读数改成毫米");
});

test("when the endpoint fails after a page exists, the page is kept and the run can continue", async ({ page }) => {
  let calls = 0;
  await page.route("https://mock.test/v1/messages", async (route: Route) => {
    calls++;
    if (calls <= 2) {
      const body = calls === 1 ? sse([SCRIPT[0][1]]) : sse([SCRIPT[1][0]]);
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body });
    } else if (calls === 3) {
      await route.fulfill({ status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify({ error: { message: "bad request" } }) });
    } else {
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse([SCRIPT[3][0]]) });
    }
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("anatomy-studio.settings", JSON.stringify({ baseUrl: "https://mock.test", model: "mock", protocol: "anthropic", maxTokens: 32000 }));
    sessionStorage.setItem("anatomy-studio.apiKey", "sk-x");
  });
  await page.reload();
  await page.getByLabel(/说出你想讲清楚的概念/).fill("解释表盘指示器");
  await page.getByRole("button", { name: /生成图解/ }).click();

  await expect(page.getByText("未完成：")).toBeVisible({ timeout: 60_000 });
  await expect(page.frameLocator('iframe[title="生成的图解"]').locator(".iso-plate")).toBeVisible();
  await expect(page.locator("#history").getByText(/未完成 · /)).toBeVisible();

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByText("用表盘读出量块高度。")).toBeVisible({ timeout: 60_000 });
});
