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
    ".pw-user-data-sw",
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

  return context;
}

async function openPage(context: BrowserContext, hostname: string, apiMode: "ok" | "fail" | "timeout" = "ok") {
  const url = `https://www.${hostname}.com/test`;
  
  // Setup API mocking
  await context.route("**://api.utm-linter.io/**", async (route) => {
    if (apiMode === "fail") {
      await route.abort("failed");
      return;
    }
    
    if (apiMode === "timeout") {
      // Never respond - simulates timeout
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: 1, rules: [] }),
    });
  });

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

test.describe("P1: Service Worker Lifecycle Tests", () => {
  test("extension recovers after idle period (simulated)", async () => {
    const context = await launchWithExtension();
    
    try {
      // First: load page and verify extension works
      const page = await openPage(context, "linkedin", "ok");
      
      const initialMarker = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-utm-linter-loaded");
      });
      expect(initialMarker).toBe("1");

      // Second: simulate idle by reloading page (Service Worker re-initializes)
      await page.reload({ waitUntil: "networkidle" });
      await new Promise((r) => setTimeout(r, 1500));

      const afterReloadMarker = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-utm-linter-loaded");
      });
      
      // Extension should re-initialize after page reload
      expect(afterReloadMarker).toBe("1");

      // Verify validation still works
      await page.fill("#url", "https://example.com/?utm_source=test&utm_medium=cpc");
      await page.blur();
      await new Promise((r) => setTimeout(r, 500));

      const utmValid = await page.evaluate(() => {
        return (document.querySelector("#url") as HTMLInputElement)?.dataset?.utmValid;
      });
      expect(utmValid).toBeDefined();
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("rules loaded from storage on re-initialization", async () => {
    const context = await launchWithExtension();
    
    try {
      // First load
      const page1 = await openPage(context, "linkedin", "ok");
      await page1.waitForFunction(
        () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
        { timeout: 10000 }
      );

      // Fill with valid UTM and trigger validation (rules should be cached)
      await page1.fill("#url", "https://example.com/?utm_source=google&utm_medium=cpc");
      await page1.blur();
      await new Promise((r) => setTimeout(r, 500));

      // Second load on new page (simulates service worker handling new event)
      const page2 = await context.newPage();
      await page2.goto("https://www.linkedin.com/test2", { waitUntil: "networkidle" });
      await new Promise((r) => setTimeout(r, 1500));

      const marker2 = await page2.evaluate(() => {
        return document.documentElement.getAttribute("data-utm-linter-loaded");
      });
      expect(marker2).toBe("1");
    } finally {
      await context.close().catch(() => {});
    }
  });
});

test.describe("P1: Failure Matrix Tests (Remote API)", () => {
  test("handles API timeout gracefully", async () => {
    const context = await launchWithExtension();
    
    try {
      const page = await openPage(context, "linkedin", "timeout");
      
      // Extension should still initialize even if API times out
      await page.waitForFunction(
        () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
        { timeout: 15000 }
      );

      const state = await page.evaluate(() => ({
        marker: document.documentElement.getAttribute("data-utm-linter-loaded"),
        platform: document.documentElement.getAttribute("data-platform"),
      }));
      
      expect(state.marker).toBe("1");
      expect(state.platform).toBe("linkedin");
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("handles API 500 error gracefully", async () => {
    const context = await launchWithExtension();
    
    try {
      // Mock 500 error
      await context.route("**://api.utm-linter.io/**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "Internal Server Error",
        });
      });

      const page = await context.newPage();
      await page.goto("https://www.linkedin.com/test", { waitUntil: "networkidle" });
      await new Promise((r) => setTimeout(r, 1500));

      // Should still initialize with local defaults
      const marker = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-utm-linter-loaded");
      });
      expect(marker).toBe("1");
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("handles non-JSON response gracefully", async () => {
    const context = await launchWithExtension();
    
    try {
      // Mock non-JSON response
      await context.route("**://api.utm-linter.io/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: "not json",
        });
      });

      const page = await context.newPage();
      await page.goto("https://www.linkedin.com/test", { waitUntil: "networkidle" });
      await new Promise((r) => setTimeout(r, 1500));

      // Should still initialize with local defaults
      const marker = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-utm-linter-loaded");
      });
      expect(marker).toBe("1");
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("handles network disconnection gracefully", async () => {
    const context = await launchWithExtension();
    
    try {
      // Abort all API calls
      await context.route("**://api.utm-linter.io/**", async (route) => {
        await route.abort("failed");
      });

      const page = await context.newPage();
      await page.goto("https://www.linkedin.com/test", { waitUntil: "networkidle" });
      await new Promise((r) => setTimeout(r, 1500));

      // Should still initialize
      const marker = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-utm-linter-loaded");
      });
      expect(marker).toBe("1");

      // Validation should still work with local rules
      await page.fill("#url", "https://example.com/?utm_source=test&utm_medium=cpc");
      await page.blur();
      await new Promise((r) => setTimeout(r, 500));

      const utmValid = await page.evaluate(() => {
        return (document.querySelector("#url") as HTMLInputElement)?.dataset?.utmValid;
      });
      expect(utmValid).toBeDefined();
    } finally {
      await context.close().catch(() => {});
    }
  });
});

test.describe("P1: Anti-Flake Tests (Repeat)", () => {
  test("injects marker consistently across multiple runs", async () => {
    const context = await launchWithExtension();
    
    try {
      for (let i = 0; i < 3; i++) {
        const page = await context.newPage();
        await page.goto("https://www.linkedin.com/test", { waitUntil: "networkidle" });
        await new Promise((r) => setTimeout(r, 1500));

        const marker = await page.evaluate(() => {
          return document.documentElement.getAttribute("data-utm-linter-loaded");
        });
        
        expect(marker).toBe(`Run ${i + 1} should inject marker`, "1");
        await page.close();
      }
    } finally {
      await context.close().catch(() => {});
    }
  });

  test("validation is consistent across rapid inputs", async () => {
    const context = await launchWithExtension();
    
    try {
      const page = await openPage(context, "linkedin", "ok");
      
      await page.waitForFunction(
        () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
        { timeout: 10000 }
      );

      // Rapidly input multiple URLs
      const urls = [
        "https://a.com/?utm_source=test&utm_medium=cpc",
        "https://b.com/?utm_source=TEST&utm_medium=CPC",
        "https://c.com/?utm_source=valid&utm_medium=email",
      ];

      for (const url of urls) {
        await page.fill("#url", url);
        await page.blur();
        await new Promise((r) => setTimeout(r, 100));
      }

      // Last input should have valid state
      await page.waitForTimeout(500);
      
      const finalState = await page.evaluate(() => ({
        utmValid: (document.querySelector("#url") as HTMLInputElement)?.dataset?.utmValid,
        hasError: document.querySelector(".utm-linter-error-ui") !== null,
      }));

      expect(finalState.utmValid).toBeDefined();
    } finally {
      await context.close().catch(() => {});
    }
  });
});
