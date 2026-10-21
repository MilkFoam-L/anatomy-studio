import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeProvider, DEFAULT_SETTINGS, isConfigured, loadSettings, saveSettings } from "../../src/lib/settings";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
  keys = () => [...this.data.keys()];
}

let local: MemoryStorage;
let session: MemoryStorage;
beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
});
afterEach(() => vi.unstubAllGlobals());

describe("settings", () => {
  it("keeps a separate address, key and model per protocol", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      protocol: "openai" as const,
      profiles: {
        anthropic: { ...DEFAULT_SETTINGS.profiles.anthropic, baseUrl: "https://a.example", apiKey: "sk-a", model: "claude-a" },
        openai: { ...DEFAULT_SETTINGS.profiles.openai, baseUrl: "https://o.example", apiKey: "sk-o", model: "claude-o" },
      },
    };
    saveSettings(settings);
    const loaded = loadSettings();
    expect(loaded).toEqual(settings);
    expect(activeProvider(loaded)).toMatchObject({ protocol: "openai", baseUrl: "https://o.example", apiKey: "sk-o", model: "claude-o" });
    expect(activeProvider({ ...loaded, protocol: "anthropic" })).toMatchObject({ protocol: "anthropic", apiKey: "sk-a" });
    // Keys stay out of the settings blob and, unless remembered, out of localStorage.
    expect(local.getItem("anatomy-studio.settings")).not.toContain("sk-");
    expect(local.keys().some((k) => k.includes("apiKey"))).toBe(false);
  });

  it("moves the single profile of earlier versions to its protocol", () => {
    local.setItem("anatomy-studio.settings", JSON.stringify({ protocol: "anthropic", baseUrl: "https://relay.example", model: "m", maxTokens: 16000 }));
    session.setItem("anatomy-studio.apiKey", "sk-old");
    const loaded = loadSettings();
    expect(loaded.profiles.anthropic).toMatchObject({ baseUrl: "https://relay.example", model: "m", maxTokens: 16000, apiKey: "sk-old" });
    expect(loaded.profiles.openai.apiKey).toBe("");
    expect(isConfigured(loaded)).toBe(true);
    expect(isConfigured({ ...loaded, protocol: "openai" })).toBe(false);
  });
});
