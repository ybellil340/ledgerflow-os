// src/__tests__/no_browser_secrets.test.ts
// Phase D — Commit 4: Structural test verifying no browser-side OCR secret paths remain.
// Scans client-side source for forbidden patterns.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/** Recursively collect file paths matching extensions */
function walk(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, supabase (server-side)
      if (["node_modules", ".git", "supabase", "dist", ".next"].includes(entry.name)) continue;
      results.push(...walk(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe("No browser-side OCR secrets", () => {
  const srcDir = path.resolve(__dirname, "..");
  const clientFiles = walk(srcDir, [".ts", ".tsx", ".js", ".jsx"]);

  it("found client source files to scan", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it("no client file references VITE_ANTHROPIC_KEY", () => {
    const violations: string[] = [];
    for (const file of clientFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("VITE_ANTHROPIC_KEY") || content.includes("VITE_ANTHROPIC")) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no client file calls api.anthropic.com directly", () => {
    const violations: string[] = [];
    for (const file of clientFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("api.anthropic.com") && !file.includes("__tests__")) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no client file imports @anthropic-ai/sdk", () => {
    const violations: string[] = [];
    for (const file of clientFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("@anthropic-ai/sdk") && !file.includes("__tests__")) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it("scanReceipt.ts uses supabase.functions.invoke, not direct fetch", () => {
    const scanReceiptPath = path.resolve(srcDir, "lib", "scanReceipt.ts");
    if (!fs.existsSync(scanReceiptPath)) {
      // File might not exist in test env — skip gracefully
      return;
    }
    const content = fs.readFileSync(scanReceiptPath, "utf-8");

    expect(content).toContain("supabase.functions.invoke");
    expect(content).not.toContain("x-api-key");
    expect(content).not.toContain("ANTHROPIC_API_KEY");
  });

  it(".env does not contain VITE_ANTHROPIC", () => {
    const envPath = path.resolve(srcDir, "..", ".env");
    if (!fs.existsSync(envPath)) return; // no .env in CI
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).not.toMatch(/VITE_ANTHROPIC/);
  });
});
