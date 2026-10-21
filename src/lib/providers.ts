import type { Protocol } from "../llm/types";

/** The relay that sponsors the project. New visitors start on it; anyone can switch to their own. */
export const SPONSOR = {
  name: "ApophisCode",
  site: "https://www.apophis.uk/",
  baseUrl: "https://speed.apophis.uk",
  tagline: "多模型接入，专注 AI 编程与应用开发",
  blurb: "支持 Claude、OpenAI、Gemini、Grok、DeepSeek、GLM 等模型，兼容 Anthropic 与 OpenAI 协议，多线路调度与故障切换，用量、Token 与费用明细清晰可查。",
} as const;

export type PresetId = "sponsor" | "anthropic" | "custom";

export interface Preset {
  id: Exclude<PresetId, "custom">;
  label: string;
  baseUrl: string;
  protocols: Protocol[];
}

export const PRESETS: Preset[] = [
  { id: "sponsor", label: SPONSOR.name, baseUrl: SPONSOR.baseUrl, protocols: ["anthropic", "openai"] },
  { id: "anthropic", label: "Anthropic 官方", baseUrl: "https://api.anthropic.com", protocols: ["anthropic"] },
];

const origin = (url: string) => {
  try {
    return new URL(url.trim()).origin;
  } catch {
    return null;
  }
};

/** Which preset an address belongs to; anything else (including an empty field) is custom. */
export function presetOf(baseUrl: string, protocol: Protocol): PresetId {
  const at = origin(baseUrl);
  return PRESETS.find((p) => p.protocols.includes(protocol) && origin(p.baseUrl) === at)?.id ?? "custom";
}
