import type { Effort, Protocol, ProviderSettings } from "../llm/types";

/** What one protocol needs. Each protocol keeps its own, since relays usually issue
 *  different keys (and often different addresses) for /v1/messages and /v1/chat/completions. */
export type Profile = Omit<ProviderSettings, "protocol">;

export interface StudioSettings {
  protocol: Protocol;
  profiles: Record<Protocol, Profile>;
  /** Keep the API keys in localStorage across sessions instead of only this tab. */
  rememberKey: boolean;
}

export const PROTOCOLS: Protocol[] = ["anthropic", "openai"];

const KEY = "anatomy-studio.settings";
const SECRET = "anatomy-studio.apiKey";
const secretKey = (protocol: Protocol) => `${SECRET}.${protocol}`;

const DEFAULT_PROFILES: Record<Protocol, Profile> = {
  anthropic: { baseUrl: "https://api.anthropic.com", apiKey: "", model: "claude-opus-5-5", maxTokens: 32000, effort: "" },
  openai: { baseUrl: "", apiKey: "", model: "claude-opus-5-5", maxTokens: 32000, effort: "" },
};

export const DEFAULT_SETTINGS: StudioSettings = { protocol: "anthropic", profiles: DEFAULT_PROFILES, rememberKey: false };

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

type Saved = Partial<Pick<StudioSettings, "protocol" | "rememberKey">> & {
  profiles?: Partial<Record<Protocol, Partial<Profile>>>;
  // The single shared profile of earlier versions.
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  effort?: Effort;
};

export function loadSettings(): StudioSettings {
  const local = storage("local");
  const session = storage("session");
  let saved: Saved = {};
  try {
    saved = JSON.parse(local?.getItem(KEY) ?? "{}");
  } catch {
    saved = {};
  }
  const protocol: Protocol = saved.protocol === "openai" ? "openai" : "anthropic";
  const legacy: Partial<Profile> = saved.profiles ? {} : { baseUrl: saved.baseUrl, model: saved.model, maxTokens: saved.maxTokens, effort: saved.effort };
  const secret = (p: Protocol) =>
    local?.getItem(secretKey(p)) ?? session?.getItem(secretKey(p)) ?? (p === protocol ? local?.getItem(SECRET) ?? session?.getItem(SECRET) : null) ?? "";
  const profile = (p: Protocol): Profile => {
    const stored = saved.profiles?.[p] ?? (p === protocol ? legacy : {});
    const defined = Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== undefined));
    return { ...DEFAULT_PROFILES[p], ...defined, apiKey: secret(p) };
  };
  return { protocol, rememberKey: Boolean(saved.rememberKey), profiles: { anthropic: profile("anthropic"), openai: profile("openai") } };
}

export function saveSettings(settings: StudioSettings): void {
  const local = storage("local");
  const session = storage("session");
  const profiles = Object.fromEntries(PROTOCOLS.map((p) => {
    const { apiKey: _, ...rest } = settings.profiles[p];
    return [p, rest];
  }));
  try {
    local?.setItem(KEY, JSON.stringify({ protocol: settings.protocol, rememberKey: settings.rememberKey, profiles }));
    for (const key of [SECRET, ...PROTOCOLS.map(secretKey)]) {
      local?.removeItem(key);
      session?.removeItem(key);
    }
    for (const p of PROTOCOLS) {
      const apiKey = settings.profiles[p].apiKey;
      if (apiKey) (settings.rememberKey ? local : session)?.setItem(secretKey(p), apiKey);
    }
  } catch {
    // Storage can be full or blocked (private mode); settings then live for this page only.
  }
}

/** The settings requests are made with: the selected protocol and its own profile. */
export const activeProvider = (s: StudioSettings): ProviderSettings => ({ protocol: s.protocol, ...s.profiles[s.protocol] });

export const isConfigured = (s: StudioSettings) => {
  const { apiKey, baseUrl, model } = s.profiles[s.protocol];
  return Boolean(apiKey && baseUrl && model);
};
