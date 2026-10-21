import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, EyeIcon, EyeOffIcon, Loader2Icon, PlugZapIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { listModels, ping } from "@/llm/client";
import { apiRoot } from "@/llm/anthropic";
import type { Effort, Protocol } from "@/llm/types";
import { PRESETS, SPONSOR, presetOf, type PresetId } from "@/lib/providers";
import { activeProvider, type Profile, type StudioSettings } from "@/lib/settings";
import { Segmented } from "./Segmented";

interface SettingsDialogProps {
  open: boolean;
  settings: StudioSettings;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: StudioSettings) => void;
}

/** What differs between the two wire protocols, as the form explains it. */
const PROTOCOL_INFO: Record<Protocol, { placeholder: string; path: string; auth: string; effort: string }> = {
  anthropic: {
    placeholder: "https://api.anthropic.com 或 https://your-relay.example",
    path: "/v1/messages",
    auth: "x-api-key（中转站另带 Authorization: Bearer）",
    effort: "output_config.effort",
  },
  openai: {
    placeholder: "https://your-relay.example 或 https://openrouter.ai/api",
    path: "/v1/chat/completions",
    auth: "Authorization: Bearer",
    effort: "reasoning_effort",
  },
};

const message = (error: unknown) => (error instanceof TypeError ? "接口地址格式不正确" : error instanceof Error ? error.message : String(error));

function SponsorCard() {
  return (
    <aside aria-label="赞助商" className="grid gap-1.5 rounded-md border border-signal/30 bg-signal/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{SPONSOR.name}</span>
        <Badge variant="outline" className="border-signal/40 text-signal">赞助</Badge>
        <a href={SPONSOR.site} target="_blank" rel="noopener noreferrer sponsored" className={buttonVariants({ variant: "outline", size: "xs", className: "ml-auto" })}>
          获取 API Key
          <ArrowUpRightIcon />
        </a>
      </div>
      <p className="text-xs font-medium text-ink-soft">{SPONSOR.tagline}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{SPONSOR.blurb}</p>
    </aside>
  );
}

export function SettingsDialog({ open, settings, onOpenChange, onSave }: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"models" | "ping" | null>(null);
  const baseUrlInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const profile = draft.profiles[draft.protocol];
  const info = PROTOCOL_INFO[draft.protocol];
  const set = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setField = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((d) => ({ ...d, profiles: { ...d.profiles, [d.protocol]: { ...d.profiles[d.protocol], [key]: value } } }));
  const switchProtocol = (protocol: Protocol) => {
    set("protocol", protocol);
    setModels([]);
  };
  const preset = presetOf(profile.baseUrl, draft.protocol);
  const choosePreset = (id: PresetId) => {
    setModels([]);
    const chosen = PRESETS.find((p) => p.id === id);
    if (chosen) return setField("baseUrl", chosen.baseUrl);
    if (preset !== "custom") setField("baseUrl", "");
    requestAnimationFrame(() => baseUrlInput.current?.focus());
  };
  const endpoint = (() => {
    try {
      return profile.baseUrl.trim() ? `${new URL(apiRoot(profile.baseUrl)).href.replace(/\/$/, "")}${info.path}` : info.path;
    } catch {
      return info.path;
    }
  })();

  const fetchModels = async () => {
    setBusy("models");
    try {
      const list = await listModels(activeProvider(draft));
      setModels(list);
      toast.success(`找到 ${list.length} 个模型`);
    } catch (error) {
      toast.error(`获取模型列表失败：${message(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("ping");
    try {
      const reply = await ping(activeProvider(draft));
      toast.success(`连接成功，模型回复：${reply.slice(0, 40)}`);
    } catch (error) {
      toast.error(`连接失败：${message(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const valid = profile.baseUrl.trim() && profile.apiKey.trim() && profile.model.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>接口设置</DialogTitle>
          <DialogDescription>填写 Claude 官方接口或任意中转站。请求直接从你的浏览器发出，不经过本站服务器。</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            onSave({ ...draft, profiles: { ...draft.profiles, [draft.protocol]: { ...profile, baseUrl: profile.baseUrl.trim(), apiKey: profile.apiKey.trim(), model: profile.model.trim() } } });
            onOpenChange(false);
          }}
        >
          <div className="grid gap-1.5">
            <Segmented<Protocol>
              label="协议"
              value={draft.protocol}
              onChange={switchProtocol}
              options={[
                { value: "anthropic", label: "Anthropic", hint: "Claude 原生 Messages 协议" },
                { value: "openai", label: "OpenAI 兼容", hint: "Chat Completions 协议" },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {draft.protocol === "anthropic"
                ? "推荐。保留思考块，截图直接放在工具结果里回传，和 skill 原本的工作方式一致。"
                : "用于只提供 OpenAI 格式的中转站。思考块不会回传，截图改为附在下一条用户消息里，效果可能略差。"}
              两个协议的地址、Key、模型分开保存，切换不会互相覆盖。
            </p>
          </div>

          <div className="grid gap-2">
            <Segmented<PresetId>
              label="服务商"
              value={preset}
              onChange={choosePreset}
              options={[
                ...PRESETS.filter((p) => p.protocols.includes(draft.protocol)).map((p) => ({ value: p.id, label: p.label })),
                { value: "custom", label: "自定义", hint: "填写你自己的接口地址" },
              ]}
            />
            {preset === "sponsor" && <SponsorCard />}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="base-url">接口地址</Label>
            <Input ref={baseUrlInput} id="base-url" inputMode="url" autoComplete="off" spellCheck={false} placeholder={info.placeholder} value={profile.baseUrl} onChange={(e) => setField("baseUrl", e.target.value)} />
            <p className="break-all text-xs text-muted-foreground">
              填根地址即可，结尾的 /v1 会自动处理。实际请求 <span className="font-mono">POST {endpoint}</span>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input id="api-key" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="sk-…" className="pr-10 font-mono" value={profile.apiKey} onChange={(e) => setField("apiKey", e.target.value)} />
              <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={showKey ? "隐藏密钥" : "显示密钥"} onClick={() => setShowKey((v) => !v)}>
                {showKey ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">放在请求头 <span className="font-mono">{info.auth}</span>。</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">模型</Label>
              <Button type="button" variant="ghost" size="xs" disabled={!profile.apiKey || busy !== null} onClick={fetchModels}>
                {busy === "models" ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                获取列表
              </Button>
            </div>
            <Input id="model" list="model-options" autoComplete="off" spellCheck={false} className="font-mono" value={profile.model} onChange={(e) => setField("model", e.target.value)} />
            <datalist id="model-options">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">需要支持工具调用和图片输入。推荐 Opus 级别模型，效果明显更好。</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="max-tokens">单次最大输出 tokens</Label>
            <Input id="max-tokens" type="number" min={4000} max={128000} step={1000} className="font-mono" value={profile.maxTokens} onChange={(e) => setField("maxTokens", Number(e.target.value))} onBlur={() => setField("maxTokens", Math.min(128000, Math.max(4000, Math.round(profile.maxTokens / 1000) * 1000 || 32000)))} />
          </div>

          <div className="grid gap-1.5">
            <Segmented<Effort>
              label="思考强度"
              value={profile.effort ?? ""}
              onChange={(value) => setField("effort", value)}
              options={[
                { value: "", label: "默认" },
                { value: "low", label: "低" },
                { value: "medium", label: "中" },
                { value: "high", label: "高" },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              以 <span className="font-mono">{info.effort}</span> 发送。调低更快更省，但图的细节会变少。「默认」不发送该参数，兼容性最好。
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/40 p-3">
            <div className="grid gap-1">
              <Label htmlFor="remember">在本浏览器记住密钥</Label>
              <p className="text-xs text-muted-foreground">关闭时密钥只保存在当前标签页，关闭即清除。</p>
            </div>
            <Switch id="remember" checked={draft.rememberKey} onCheckedChange={(checked) => set("rememberKey", checked)} />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
            生成的图解代码只在无源（opaque origin）沙箱里运行，读不到你的密钥；在本站预览和检查时也不能联网。
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={!valid || busy !== null} onClick={test}>
              {busy === "ping" ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
              测试连接
            </Button>
            <Button type="submit" disabled={!valid}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
