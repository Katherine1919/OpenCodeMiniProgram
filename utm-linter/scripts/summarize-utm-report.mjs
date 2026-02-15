import fs from "fs";

const reportPath = "test-results/utm-report.json";

if (!fs.existsSync(reportPath)) {
  console.error("❌ 未找到报告文件:", reportPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
const s = data.stats || {};

console.log("=== UTM Linter Test Summary ===");
console.log("✅ Passed:", s.expected ?? 0);
console.log("❌ Failed:", s.unexpected ?? 0);
console.log("⏭️ Skipped:", s.skipped ?? 0);
console.log("🌀 Flaky:", s.flaky ?? 0);
console.log("⏱ Duration(s):", s.duration ? (s.duration / 1000).toFixed(1) : "N/A");
