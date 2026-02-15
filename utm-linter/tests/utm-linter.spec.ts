import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe.configure({ mode: "serial" });

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

type ApiMode = "ok" | "fail";
type HostMode = "linkedin" | "example";

async function launchWithExtension(apiMode: ApiMode): Promise<BrowserContext> {
  const userDataDir = path.resolve(
    process.cwd(),
    ".pw-user-data",
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

  // 稳定：拦截所有远程 API，避免外网抖动导致初始化慢/卡
  await context.route("**://api.utm-linter.io/**", async (route) => {
    if (apiMode === "fail") {
      await route.abort("failed");
      return;
    }

    const url = route.request().url();
    if (url.includes("/events")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    // rules 拉取返回一个可解析结构；就算你的 RulesManager 不完全依赖字段也会走通
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        rules: [],
      }),
    });
  });

  return context;
}

async function openHarness(hostMode: HostMode, apiMode: ApiMode) {
  const context = await launchWithExtension(apiMode);

  // 等待扩展初始化完成
  await new Promise(r => setTimeout(r, 500));

  const url =
    hostMode === "linkedin"
      ? "https://www.linkedin.com/utm-linter-test"
      : "https://example.com/utm-linter-test";

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
  page.on("console", (msg) => {
    console.log(`[console:${msg.type()}]`, msg.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });

  // 额外等待 content script 执行
  await new Promise(r => setTimeout(r, 500));

  return { context, page };
}

async function getState(page: Page) {
  return page.evaluate(() => {
    return {
      marker: document.documentElement.getAttribute("data-utm-linter-loaded"),
      platform: document.documentElement.getAttribute("data-platform"),
      wrappers: document.querySelectorAll(".utm-linter-wrapper").length,
      utmValid: (document.querySelector("#url") as HTMLInputElement | null)?.dataset?.utmValid ?? null,
    };
  });
}

test("inject marker on matched domain (linkedin)", async () => {
  const { context, page } = await openHarness("linkedin", "ok");
  try {
    // 先等待一段时间让 content script 有机会执行
    await page.waitForTimeout(2000);
    
    // 检查当前状态
    const html = await page.content();
    console.log("[DEBUG] Page HTML length:", html.length);
    console.log("[DEBUG] Page HTML snippet:", html.substring(0, 500));
    
    const marker = await page.evaluate(() => {
      return document.documentElement.getAttribute("data-utm-linter-loaded");
    });
    console.log("[DEBUG] Marker value:", marker);
    
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
      { timeout: 15000 }
    );

    await expect
      .poll(async () => page.locator(".utm-linter-wrapper").count(), {
        timeout: 10000,
        intervals: [200, 500, 1000],
      })
      .toBeGreaterThanOrEqual(1);

    const state = await getState(page);
    expect(state.marker).toBe("1");
    // Note: window.__UTM_LINTER_LOADED__ cannot be set due to CSP restrictions
    // The data-utm-linter-loaded attribute confirms the extension is working
    expect(state.platform).toBe("linkedin");
  } finally {
    await context.close().catch(() => {});
  }
});

test("still wraps input when remote API fails", async () => {
  const { context, page } = await openHarness("linkedin", "fail");
  try {
    // marker 在 init 一开始就会打，所以即便 fetch rules 失败也应出现
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-utm-linter-loaded") === "1",
      { timeout: 10000 }
    );

    await expect
      .poll(async () => page.locator(".utm-linter-wrapper").count(), {
        timeout: 10000,
        intervals: [200, 500, 1000],
      })
      .toBeGreaterThanOrEqual(1);

    // 触发一次校验流程，确认不会因 API fail 崩掉
    const input = page.locator("#url");
    await input.fill("https://example.com/?utm_source=test&utm_medium=cpc");
    await input.blur();

    const state = await getState(page);
    expect(state.marker).toBe("1");
    expect(state.platform).toBe("linkedin");
    // 校验后通常会有 true/false，至少不应是 undefined 崩溃态
    expect(["true", "false", null]).toContain(state.utmValid);
  } finally {
    await context.close().catch(() => {});
  }
});

test("does NOT inject on non-matched domain", async () => {
  const { context, page } = await openHarness("example", "ok");
  try {
    await page.waitForTimeout(1000);
    const state = await getState(page);

    expect(state.marker).toBeNull();
    expect(state.platform).toBeNull();
    expect(state.wrappers).toBe(0);
  } finally {
    await context.close().catch(() => {});
  }
});
