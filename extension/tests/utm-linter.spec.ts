import { test, expect, chromium, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

const EXT_PATH = process.env.EXT_PATH || path.resolve(process.cwd(), "dist");

async function launchContext(apiDown = false): Promise<BrowserContext> {
  if (!fs.existsSync(path.join(EXT_PATH, "manifest.json"))) {
    throw new Error(`manifest.json not found in EXT_PATH: ${EXT_PATH}`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-utm-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });

  if (apiDown) {
    await context.route("https://api.utm-linter.io/**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "mock down" }),
      });
    });
  }
  return context;
}

function harnessHTML() {
  return `<!doctype html>
<html>
  <body>
    <form id="adForm">
      <input id="dest" type="url" placeholder="URL" />
      <button id="submitBtn" type="submit">Submit</button>
    </form>
  </body>
</html>`;
}

async function openHarness(context: BrowserContext, host: string, pathName: string): Promise<Page> {
  const page = await context.newPage();
  const url = `https://${host}/${pathName}`;

  const handler = async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: harnessHTML(),
    });
  };

  await context.route(url, handler);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await context.unroute(url, handler);
  return page;
}

test("inject marker on matched domain (linkedin)", async () => {
  const context = await launchContext(false);
  const page = await openHarness(context, "www.linkedin.com", "utm-linter-test-1");

  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
    null,
    { timeout: 20000 }
  );

  const marker = await page.evaluate(
    () => document.documentElement.getAttribute("data-utm-linter-loaded")
  );
  expect(marker).toBe("1");

  await context.close();
});

test("still wraps input when remote API fails", async () => {
  const context = await launchContext(true);
  const page = await openHarness(context, "www.linkedin.com", "utm-linter-test-2");

  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
    null,
    { timeout: 20000 }
  );

  await page.waitForFunction(
    () => document.querySelectorAll(".utm-linter-wrapper").length >= 1,
    null,
    { timeout: 20000 }
  );

  const wrappers = await page.evaluate(
    () => document.querySelectorAll(".utm-linter-wrapper").length
  );
  expect(wrappers).toBeGreaterThanOrEqual(1);

  await context.close();
});

test("does NOT inject on non-matched domain", async () => {
  const context = await launchContext(false);
  const page = await openHarness(context, "example.com", "utm-linter-test-3");

  await page.waitForTimeout(1200);

  const marker = await page.evaluate(
    () => document.documentElement.getAttribute("data-utm-linter-loaded")
  );
  expect(marker).toBeNull();

  await context.close();
});
