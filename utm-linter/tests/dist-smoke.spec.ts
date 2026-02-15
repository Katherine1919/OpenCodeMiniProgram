import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DIST_PATH = path.resolve(process.cwd(), "./dist");
const MANIFEST_PATH = path.join(DIST_PATH, "manifest.json");

test.describe("P0: Dist-level Smoke Tests", () => {
  test("manifest.json exists and is valid JSON", () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const manifest = JSON.parse(content);
    
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toBeTruthy();
  });

  test("content_scripts[*].js files exist as per manifest", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
    
    for (const cs of manifest.content_scripts) {
      expect(cs.js).toBeDefined();
      for (const jsPath of cs.js) {
        const fullPath = path.join(DIST_PATH, jsPath);
        expect(fs.existsSync(fullPath), `Missing content script: ${jsPath}`).toBe(true);
      }
    }
  });

  test("content script can be parsed as classic script (no import/export)", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    for (const cs of manifest.content_scripts) {
      for (const jsPath of cs.js) {
        const fullPath = path.join(DIST_PATH, jsPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        
        // Check for ES module imports
        const importMatches = content.match(/^import\s+/gm);
        expect(importMatches, `Found ES module imports in ${jsPath}: ${importMatches?.join(", ")}`).toBeNull();
        
        // Check for ES module exports
        const exportMatches = content.match(/\bexport\s+/g);
        expect(exportMatches, `Found ES module exports in ${jsPath}: ${exportMatches?.join(", ")}`).toBeNull();
        
        // Verify it's wrapped as IIFE or starts with function
        const isIIFE = content.includes("(function()") || content.includes("(function ");
        expect(isIIFE, `Content script ${jsPath} should be wrapped as IIFE for MV3 compatibility`).toBe(true);
      }
    }
  });

  test("no old window.__xxx globals - using data-* attributes instead", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    for (const cs of manifest.content_scripts) {
      for (const jsPath of cs.js) {
        const fullPath = path.join(DIST_PATH, jsPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        
        // Check for old global pattern (should not exist)
        const oldGlobalPattern = /window\.__UTM_LINTER_/;
        expect(oldGlobalPattern.test(content), 
          `Content script ${jsPath} still uses old window.__UTM_LINTER_* globals. Use data-* attributes instead.`
        ).toBe(false);
        
        // Verify new pattern exists (data-* attributes)
        const newPattern = /data-utm-linter-loaded|setAttribute\(['"]data-utm-linter-loaded['"]/;
        expect(newPattern.test(content), 
          `Content script ${jsPath} should use data-utm-linter-loaded attribute`
        ).toBe(true);
      }
    }
  });

  test("background service worker exists", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBeTruthy();
    
    const swPath = path.join(DIST_PATH, manifest.background.service_worker);
    expect(fs.existsSync(swPath), `Missing service worker: ${manifest.background.service_worker}`).toBe(true);
  });

  test("popup files exist if declared", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    if (manifest.action?.default_popup) {
      const popupPath = path.join(DIST_PATH, manifest.action.default_popup);
      expect(fs.existsSync(popupPath), `Missing popup: ${manifest.action.default_popup}`).toBe(true);
    }
  });

  test("icons exist in all required sizes", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    expect(manifest.icons).toBeDefined();
    const requiredSizes = ["16", "48", "128"];
    
    for (const size of requiredSizes) {
      const iconPath = manifest.icons[size];
      expect(iconPath, `Missing icon${size} in manifest`).toBeTruthy();
      
      const fullPath = path.join(DIST_PATH, iconPath);
      expect(fs.existsSync(fullPath), `Missing icon file: ${iconPath}`).toBe(true);
    }
  });

  test("host_permissions are properly declared", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    expect(manifest.host_permissions).toBeDefined();
    expect(manifest.host_permissions.length).toBeGreaterThan(0);
    
    // Should include linkedin, facebook, meta, google
    const hosts = JSON.stringify(manifest.host_permissions);
    expect(hosts).toContain("linkedin.com");
  });

  test("web_accessible_resources declared correctly", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    
    if (manifest.web_accessible_resources) {
      for (const war of manifest.web_accessible_resources) {
        expect(war.resources).toBeDefined();
        expect(war.matches).toBeDefined();
      }
    }
  });
});
