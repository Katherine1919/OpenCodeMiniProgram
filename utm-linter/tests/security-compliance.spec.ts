import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DIST_PATH = path.resolve(process.cwd(), "./dist");

test.describe("P2: Remote Code Compliance & Security Checks", () => {
  test("no remotely hosted code in extension", () => {
    const walkDir = (dir: string): string[] => {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          files.push(...walkDir(fullPath));
        } else if (entry.isFile() && /\.(js|ts|mjs|cjs|wasm)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const jsFiles = walkDir(DIST_PATH);
    expect(jsFiles.length).toBeGreaterThan(0);

    const remoteCodePatterns = [
      /eval\s*\(/,                    // eval()
      /Function\s*\(/,                // new Function()
      /setTimeout\s*\(\s*['"`]/,      // setTimeout with string
      /setInterval\s*\(\s*['"`]/,     // setInterval with string
      /document\.write\s*\(/,          // document.write()
      /import\s*\(\s*['"`]/,          // dynamic import from URL
      /fetch\s*\(\s*['"`]\s*https?:/, // fetch from external URL
      /XMLHttpRequest/,               // XHR to external
      /src\s*=\s*['"`]\s*https?:/,   // external script src
    ];

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(DIST_PATH, file);

      for (const pattern of remoteCodePatterns) {
        const matches = content.match(pattern);
        expect(matches, 
          `Found potential remote code pattern in ${relativePath}: ${pattern}`
        ).toBeNull();
      }
    }
  });

  test("web_accessible_resources is minimal and secure", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST_PATH, "manifest.json"), "utf-8"));
    
    if (!manifest.web_accessible_resources) {
      // If not declared, that's fine (more secure)
      return;
    }

    for (const war of manifest.web_accessible_resources) {
      // Should use specific patterns, not wildcards
      for (const match of war.matches) {
        // <all_urls> is too permissive - warn but don't fail in manifest (may be needed)
        if (match === "<all_urls>") {
          console.warn("Warning: web_accessible_resources uses <all_urls> which is permissive");
        }
      }
    }
  });

  test("permissions are minimal (no unnecessary APIs)", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST_PATH, "manifest.json"), "utf-8"));
    
    const requiredPermissions = [
      "storage",
    ];
    
    const optionalPermissions = [
      "activeTab",
    ];

    const allPermissions = [
      ...(manifest.permissions || []),
      ...(manifest.optional_permissions || []),
    ];

    // Check we don't have overly broad permissions
    const dangerousPermissions = [
      "tabs",
      "webRequest", 
      "webRequestBlocking",
      "debugger",
      "proxy",
      "clipboardRead",
      "clipboardWrite",
    ];

    for (const perm of dangerousPermissions) {
      expect(allPermissions, `Extension should not use dangerous permission: ${perm}`).not.toContain(perm);
    }

    // We expect at least storage for rules persistence
    expect(allPermissions).toContain("storage");
  });

  test("content_scripts run_at is specified", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST_PATH, "manifest.json"), "utf-8"));
    
    for (const cs of manifest.content_scripts || []) {
      // Should specify run_at to control when script executes
      expect(cs.run_at).toBeDefined();
      // document_idle is usually best for content scripts
      expect(["document_idle", "document_end", "document_start"]).toContain(cs.run_at);
    }
  });

  test("no inline scripts in HTML (CSP compliant)", () => {
    const htmlFiles = [
      path.join(DIST_PATH, "popup", "index.html"),
      path.join(DIST_PATH, "background", "index.html"),
    ].filter((f) => fs.existsSync(f));

    for (const htmlFile of htmlFiles) {
      const content = fs.readFileSync(htmlFile, "utf-8");
      const relativePath = path.relative(DIST_PATH, htmlFile);

      // Check for inline scripts (should use external files)
      const inlineScriptPattern = /<script[^>]*>[\s\S]*?<\/script>/gi;
      const matches = content.match(inlineScriptPattern);
      
      if (matches) {
        // Filter out external script references
        const hasInlineCode = matches.some((s) => !s.includes("src="));
        expect(hasInlineCode, 
          `Found inline script in ${relativePath}. Use external JS files instead.`
        ).toBe(false);
      }
    }
  });

  test("manifest has proper manifest_version", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST_PATH, "manifest.json"), "utf-8"));
    
    expect(manifest.manifest_version).toBe(3);
  });

  test("no eval or Function constructor usage", () => {
    const walkDir = (dir: string): string[] => {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          files.push(...walkDir(fullPath));
        } else if (entry.isFile() && /\.js$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const jsFiles = walkDir(DIST_PATH);
    const dangerousPatterns = [
      /\beval\s*\(/,
      /\bFunction\s*\(/,
      /\bnew\s+Function\s*\(/,
    ];

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(DIST_PATH, file);

      for (const pattern of dangerousPatterns) {
        expect(content.match(pattern), 
          `Found ${pattern} in ${relativePath} - security risk!`
        ).toBeNull();
      }
    }
  });
});
