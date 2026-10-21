// Dev-only: renders a still of every gallery page (both themes) for the gallery tiles,
// so the home page does not run seven live figures at once. Run after bundle:skill:
//   node scripts/gallery-thumbs.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GALLERY = join(ROOT, "public/gallery");
const OUT = join(ROOT, "src/assets/thumbs");
const items = JSON.parse(readFileSync(join(GALLERY, "index.json"), "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 0.75 });
for (const { file } of items) {
  await page.goto(pathToFileURL(join(GALLERY, file)).href);
  await page.waitForTimeout(2500);
  const plate = page.locator(".iso-plate").first();
  const target = (await plate.count()) ? plate : page.locator("body");
  await target.screenshot({ path: join(OUT, file.replace(/\.html$/, ".jpg")), type: "jpeg", quality: 80 });
  console.log(`thumb ${file}`);
}
await browser.close();
