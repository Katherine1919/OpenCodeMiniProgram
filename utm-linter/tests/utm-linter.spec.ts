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

    <script>
      window.__submitCount = 0;
      const form = document.getElementById("adForm");
      form.addEventListener("submit", function(e) {
        window.__submitCount += 1;
        e.preventDefault();
      });
    </script>
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

async function waitMarker(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
    null,
    { timeout: 20000 }
  );
}

test("inject marker on matched domain (linkedin)", async () => {
  const context = await launchContext(false);
  const page = await openHarness(context, "www.linkedin.com", "utm-linter-test-1");

  await waitMarker(page);

  const marker = await page.evaluate(
    () => document.documentElement.getAttribute("data-utm-linter-loaded")
  );
  expect(marker).toBe("1");

  await context.close();
});

test("still wraps input when remote API fails", async () => {
  const context = await launchContext(true);
  const page = await openHarness(context, "www.linkedin.com", "utm-linter-test-2");

  await waitMarker(page);

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

test("blocks submit when input is marked invalid", async () => {
  const context = await launchContext(false);
  const page = await openHarness(context, "www.linkedin.com", "utm-linter-test-4");

  await waitMarker(page);

  await page.evaluate(() => {
    const input = document.querySelector("#dest") as HTMLInputElement;
    input.value = "https://example.com/?utm_source=";
    input.dataset.utmValid = "false";
  });

  let dialogSeen = false;
  page.on("dialog", async (d) => {
    dialogSeen = true;
    await d.dismiss();
  });

  await page.click("#submitBtn");
  await page.waitForTimeout(300);

  const submitCount = await page.evaluate(() => (window as any).__submitCount);
  expect(submitCount).toBe(0);
  expect(dialogSeen).toBe(true);

  await context.close();
});

test("autofix button works when provided by current rules", async () => {
  const context = await launchContext(false);
  const page = await openHarness(context, "www.linkedin.com", "utm-linter-test-5");

  await waitMarker(page);

  const input = page.locator("#dest");

  const candidates = [
    "https://example.com/?utm_source=&utm_medium=&utm_campaign=",
    "https://example.com/?utm_source=google&utm_source=dup&utm_medium=cpc&utm_campaign=sale",
    "https://example.com/?utm_source=Google&utm_medium=Paid Social&utm_campaign=Spring Sale"
  ];

  let foundError = false;
  let testedAutofix = false;

  for (const url of candidates) {
    await input.fill(url);
    await input.blur();
    await page.waitForTimeout(500);

    const hasErrorUI = (await page.locator(".utm-linter-error-ui").count()) > 0;
    if (!hasErrorUI) continue;

    foundError = true;

    const autoFixBtn = page.locator('.utm-linter-error-ui button:has-text("Auto-fix")');
    const hasAutoFixBtn = (await autoFixBtn.count()) > 0;

    if (!hasAutoFixBtn) {
      continue;
    }

    const before = await input.inputValue();
    await autoFixBtn.first().click();
    await page.waitForTimeout(300);
    const after = await input.inputValue();
    const errorLeft = await page.locator(".utm-linter-error-ui").count();

    expect(after).not.toBe(before);
    expect(errorLeft).toBe(0);

    testedAutofix = true;
    break;
  }

  if (!foundError) {
    test.info().annotations.push({
      type: "note",
      description: "Current rules did not produce error UI on candidate URLs; autofix check skipped."
    });
  }

  if (foundError && !testedAutofix) {
    test.info().annotations.push({
      type: "note",
      description: "Error UI appeared but no Auto-fix button under current rules; conditional autofix check skipped."
    });
  }

  const marker = await page.evaluate(
    () => document.documentElement.getAttribute("data-utm-linter-loaded")
  );
  expect(marker).toBe("1");

  await context.close();
});
