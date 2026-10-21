import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Composer } from "@/components/studio/Composer";
import { Gallery } from "@/components/studio/Gallery";
import { HistoryList } from "@/components/studio/HistoryList";
import { SettingsDialog } from "@/components/studio/SettingsDialog";
import { TopBar } from "@/components/studio/TopBar";
import { Workbench } from "@/components/studio/Workbench";
import type { JobOptions } from "@/agent/prompt";
import { useRun, type Delivered } from "@/hooks/useRun";
import { getEngine } from "@/lib/engine";
import { deleteEntry, listEntries, type HistoryEntry } from "@/lib/history";
import { activeProvider, isConfigured, loadSettings, saveSettings, type StudioSettings } from "@/lib/settings";
import type { Stage } from "@/stage/stage";

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export default function App() {
  const [settings, setSettings] = useState<StudioSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stage, setStage] = useState<Stage | null>(null);
  const { state, start, stop, load, revise, canRevise } = useRun();
  const running = state.status === "starting" || state.status === "running";

  const refreshHistory = useCallback(() => {
    listEntries().then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    refreshHistory();
    getEngine()
      .then((engine) => setStage(engine.stage))
      .catch((error) => toast.error(`运行环境加载失败：${error instanceof Error ? error.message : error}`));
  }, [refreshHistory]);

  useEffect(() => {
    // Unfinished runs are filed too; pick them up when a run ends either way.
    if (state.status === "error" || state.status === "stopped") refreshHistory();
  }, [state.status, refreshHistory]);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [running]);

  const report = useCallback((delivered: Delivered | null, what: string) => {
    if (!delivered) return;
    if (delivered.saved) {
      toast.success(`${what}，已存入「我的图解」`);
      refreshHistory();
    } else toast.warning(`${what}，但浏览器拒绝保存到「我的图解」（存储空间不足或处于隐私模式），请及时下载`);
  }, [refreshHistory]);

  const submit = useCallback(async (job: JobOptions) => {
    if (!isConfigured(settings)) {
      setSettingsOpen(true);
      toast.info("先填写接口地址、API Key 和模型");
      return;
    }
    document.getElementById("workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
    report(await start(job, activeProvider(settings)), "图解已完成");
  }, [settings, start, report]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const retry = useCallback(() => state.job && submit(state.job), [state.job, submit]);
  const reviseFigure = useCallback(async (note: string) => report(await revise(note), "修改完成"), [revise, report]);
  const openEntry = useCallback((entry: HistoryEntry) => {
    load(entry);
    document.getElementById("workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [load]);
  const removeEntry = useCallback((entry: HistoryEntry) => deleteEntry(entry.id).then(refreshHistory), [refreshHistory]);
  const profile = settings.profiles[settings.protocol];

  return (
    <TooltipProvider>
      <div id="top" className="min-h-dvh">
        <TopBar configured={isConfigured(settings)} model={profile.model} host={`${settings.protocol === "openai" ? "OpenAI 兼容" : "Anthropic"} · ${hostOf(profile.baseUrl)}`} onSettings={openSettings} />

        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
          <div className={`grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] ${state.status === "idle" ? "lg:items-stretch" : "items-start"}`}>
            <div className="grid min-w-0 gap-6 lg:sticky lg:top-20">
              <div>
                <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-[2.6rem]">
                  把一个概念，
                  <br />
                  造成一台<span className="text-signal">会动的机器</span>。
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                  基于开源 Anatomy skill。用你自己的 Claude 接口，在浏览器里构建、审计、截图自检，交付可交互的等距图解。
                </p>
              </div>
              <Composer running={running} onSubmit={submit} onStop={stop} />
            </div>
            <div id="workbench" className="min-w-0 scroll-mt-20">
              <Workbench
                state={state}
                stage={stage}
                canRevise={canRevise}
                onRetry={retry}
                onRevise={reviseFigure}
              />
            </div>
          </div>

          <HistoryList
            entries={history}
            onOpen={openEntry}
            onDelete={removeEntry}
          />
          <Gallery />
        </main>

        <footer className="border-t">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
            <p>
              图解能力来自{" "}
              <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer">
                wheresryan22/anatomy
              </a>
              （MIT）。本站为纯静态页面，密钥只保存在你的浏览器。
            </p>
            <p className="font-mono">Anatomy Studio · MIT</p>
          </div>
        </footer>
      </div>
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onOpenChange={setSettingsOpen}
        onSave={(next) => {
          setSettings(next);
          saveSettings(next);
          toast.success("设置已保存");
        }}
      />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
