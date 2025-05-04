import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We import the module *lazily* inside each test so that we can control the
// OPENAI_API_KEY env var independently per test case. Node's module cache
// would otherwise capture the value present during the first import.

const ORIGINAL_ENV_KEY = process.env["OPENAI_API_KEY"];

beforeEach(() => {
  delete process.env["OPENAI_API_KEY"];
  // Explicitly set to empty string rather than undefined
  process.env["OPENAI_API_KEY"] = "";
  
  // We need to ensure the module cache is reset before each test
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_ENV_KEY !== undefined) {
    process.env["OPENAI_API_KEY"] = ORIGINAL_ENV_KEY;
  } else {
    delete process.env["OPENAI_API_KEY"];
  }
  
  // Clean up module cache after each test
  vi.resetModules();
});

describe("config.setApiKey", () => {
  it("overrides the exported OPENAI_API_KEY at runtime", async () => {
    // Double check environment is clean
    expect(process.env["OPENAI_API_KEY"]).toBe("");
    
    // Force modules reset to ensure fresh imports
    vi.resetModules();

    const { setApiKey, OPENAI_API_KEY } = await import(
      "../src/utils/config.js"
    );

    expect(OPENAI_API_KEY).toBe("");

    setApiKey("my‑key");

    // Re-import to verify the module's exported value changed
    vi.resetModules(); // Reset again to make sure we're not getting a cached module
    const { OPENAI_API_KEY: liveRef } = await import("../src/utils/config.js");

    expect(liveRef).toBe("my‑key");
  });
});
