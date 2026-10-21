import { describe, expect, it } from "vitest";
import { PRESETS, SPONSOR, presetOf } from "../../src/lib/providers";
import { DEFAULT_SETTINGS } from "../../src/lib/settings";

describe("provider presets", () => {
  it("starts both protocols on the sponsor relay", () => {
    expect(DEFAULT_SETTINGS.profiles.anthropic.baseUrl).toBe(SPONSOR.baseUrl);
    expect(DEFAULT_SETTINGS.profiles.openai.baseUrl).toBe(SPONSOR.baseUrl);
  });

  it("recognises a preset by origin, with or without a path", () => {
    expect(presetOf("https://speed.apophis.uk/v1", "openai")).toBe("sponsor");
    expect(presetOf("https://speed.apophis.uk/", "anthropic")).toBe("sponsor");
  });

  it("treats other, empty or malformed addresses as custom", () => {
    expect(presetOf("https://relay.example", "anthropic")).toBe("custom");
    expect(presetOf("", "anthropic")).toBe("custom");
    expect(presetOf("not a url", "openai")).toBe("custom");
  });

  it("offers the sponsor for both protocols and nothing else", () => {
    expect(PRESETS.map((p) => [p.id, p.protocols])).toEqual([["sponsor", ["anthropic", "openai"]]]);
    expect(presetOf("https://api.anthropic.com", "anthropic")).toBe("custom");
  });
});
