// Captures each checked Archify HTML in docs/diagrams/ as light and dark PNGs for the README.
// Run from the repo root: node docs/diagrams/capture.mjs
// Uses the Playwright that a sibling project already installs (see PLAYWRIGHT_ROOT), so this repo
// stays dependency-free.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_ROOT ?? path.resolve("../cmc-web-pwa");
const DIAGRAMS = ["setup", "feature-pipeline", "landing-page"];
const THEMES = ["light", "dark"];
const SCALE = 2;
const VIEWPORT = { width: 1600, height: 1200 };

const { chromium } = createRequire(path.join(PLAYWRIGHT_ROOT, "package.json"))("playwright");

const browser = await chromium.launch();
for (const name of DIAGRAMS) {
  for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: theme });
    await page.goto(pathToFileURL(path.resolve(`docs/diagrams/${name}.html`)).href);
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    // Viewer chrome (toolbar, finder, guide) is for the interactive HTML, not a static picture.
    await page.addStyleTag({ content: ".no-print, .toolbar { display: none !important; }" });
    await page.waitForTimeout(500);
    const target = page.locator(".diagram-container").first();
    const out = `docs/diagrams/${name}-${theme}.png`;
    await target.screenshot({ path: out });
    console.log("wrote", out);
    await page.close();
  }
}
await browser.close();
