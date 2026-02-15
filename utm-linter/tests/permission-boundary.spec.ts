import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EXT_PATH = process.env.EXT_PATH ?? "./dist";
const EXT_ABS = path.resolve(process.cwd(), EXT_PATH);

const HARNESS_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>UTM Harness</title></head>
  <body>
    <form id="f">
      <input id="url" type="url" placeholder="URL" />
      <button id="submit" type="submit">Submit</button>
    </form>
  </body>
</html>`;

async function launchWithExtension(): Promise<BrowserContext> {
  const userDataDir = path.resolve(
    process.cwd(),
    ".pw-user-data-perm",
    `run-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: process.env.CI ? true : false,
    args: [
      `--disable-extensions-except=${EXT_ABS}`,
      `--load-extension=${EXT_ABS}`,
      "--no-sandbox",
    ],
  });

  // Block remote API calls
  await context.route("**://api.utm-linter.io/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: 1, rules: [] }),
    });
  });

  return context;
}

async function openPage(context: BrowserContext, url: string, hostname: string) {
  await context.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: HARNESS_HTML,
    });
  });

  const page = await context.newPage();

  page.on("pageerror", (err) => {
    console.log("[pageerror]", err.message);
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await new Promise((r) => setTimeout(r, 1000));

  return page;
}

async function getState(page: Page) {
  return page.evaluate(() => {
    return {
      marker: document.documentElement.getAttribute("data-utm-linter-loaded"),
      platform: document.documentElement.getAttribute("data-platform"),
      wrappers: document.querySelectorAll(".utm-linter-wrapper").length,
    };
  });
}

test.describe("P0: Permission Boundary Tests", () => {
  test("no injection on domain without host permission", async () => {
    const context = await launchWithExtension();
    
    try {
      // Use a domain definitely not in host_permissions (e.g., unknown-site.com)
      const page = await openPage(
        context,
        "https://unknown-site-random-12345.com/test",
        "unknown-site-random-12345.com"
      );

      const state = await getState(page);

      // Should NOT inject on unknown domains
      expect(state.marker).toBeNull();
      expect(state.platform).toBeNull();
      expect(state.wrappers).toBe(0);
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("no injection on localhost without permission", async () => {
    const context = await launchWithExtension();
    
    try {
      const page = await openPage(context, "http://localhost:3000/test", "localhost");

      const state = await getState(page);

      // Localhost should not have extension injected unless explicitly permitted
      expect(state.marker).toBeNull();
      expect(state.wrappers).toBe(0);
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("injects only on explicitly permitted domains", async () => {
    const context = await launchWithExtension();
    
    try {
      // Test permitted domain
      const linkedinPage = await openPage(
        context,
        "https://www.linkedin.com/test",
        "linkedin.com"
      );
      const linkedinState = await getState(linkedinPage);
      expect(linkedinState.marker).toBe("1");
      expect(linkedinState.platform).toBe("linkedin");

      // Test non-permitted domain
      const otherPage = await openPage(
        context,
        "https://example-random-xyz.com/test",
        "example-random-xyz.com"
      );
      const otherState = await getState(otherPage);
      expect(otherState.marker).toBeNull();
      expect(otherState.wrappers).toBe(0);
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("extension API not accessible from web page", async () => {
    const context = await launchWithExtension();
    
    try {
      const page = await openPage(context, "https://www.linkedin.com/test", "linkedin.com");

      // Wait for extension to inject
      await page.waitForFunction(
        () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
        { timeout: 10000 }
      );

      // Try to access chrome.runtime from page context (should fail/isolated)
      const canAccessRuntime = await page.evaluate(() => {
        try {
          // @ts-ignore
          return typeof chrome !== "undefined" && chrome.runtime !== undefined;
        } catch {
          return false;
        }
      });

      // Content scripts run in isolated world, web page cannot access extension APIs directly
      // This is actually a browser security feature, not something we enforce
      // But we verify the extension is properly isolated
      expect(canAccessRuntime).toBe(false);
    } finally {
      await context.close().catch(() => {});
    }
  });
});
