import { memo, useEffect, useState } from "react";
import { DownloadIcon, ExternalLinkIcon, FileIcon, PlayIcon, RotateCcwIcon, WandSparklesIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import type { RunState } from "@/hooks/useRun";
import { galleryUrl } from "@/lib/assets";
import { download, mimeOf, openInTab } from "@/lib/download";
import type { Stage } from "@/stage/stage";
import { cn } from "@/lib/utils";
import { FigureFrame, FittedFigureFrame } from "./FigureFrame";
import { RunLog } from "./RunLog";
import { StageView } from "./StageView";
import { useColorScheme } from "@/hooks/useColorScheme";

const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const baseName = (key: string) => key.split("/").pop() ?? key;

/** The run's elapsed time; ticks on its own so the rest of the workbench stays still. */
function Elapsed({ from, to, running }: { from: number; to: number; running: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return <>{fmtTime((running ? now : to) - from)}</>;
}

/** Keeps showing the previous image until the next one is decoded, so swaps never flash. */
function useDecoded(url: string | null): string | null {
  const [shown, setShown] = useState(url);
  useEffect(() => {
    if (!url) return setShown(null);
    let live = true;
    const image = new Image();
    image.src = url;
    image.decode().catch(() => undefined).then(() => live && setShown(url));
    return () => {
      live = false;
    };
  }, [url]);
  return shown;
}

interface WorkbenchProps {
  state: RunState;
  stage: Stage | null;
  canRevise: boolean;
  onRetry: () => void;
  onRevise: (note: string) => void;
}

function ReviseBar({ onRevise }: { onRevise: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <form
      className="flex gap-2 border-t bg-background/60 px-5 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (note.trim().length < 2) return;
        onRevise(note.trim());
        setNote("");
      }}
    >
      <label htmlFor="revise" className="sr-only">修改意见</label>
      <Input id="revise" value={note} onChange={(e) => setNote(e.target.value)} placeholder="继续修改：例如“把底座加宽，读数改成每秒请求数”" className="h-9 bg-background" />
      <Button type="submit" variant="secondary" size="lg" disabled={note.trim().length < 2}>
        <WandSparklesIcon />
        修改
      </Button>
    </form>
  );
}

export const Workbench = memo(function Workbench({ state, stage, canRevise, onRetry, onRevise }: WorkbenchProps) {
  const running = state.status === "starting" || state.status === "running";
  const lastShot = useDecoded(state.lastShot?.url ?? null);
  const { result } = state;
  const theme = state.job?.theme ?? "light";
  const [scheme] = useColorScheme();

  if (state.status === "idle") {
    return (
      <section aria-label="示例图解" className="plate flex h-full flex-col overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pt-4">
          <span className="label-caps">示例 · dial indicator</span>
          <span className="label-caps hidden sm:inline">悬停试试</span>
        </div>
        <FittedFigureFrame
          title="示例：表盘指示器"
          src={galleryUrl(scheme === "dark" ? "dial-indicator.html" : "dial-indicator-light.html")}
          minWidth={640}
          minHeight={760}
          className="h-[min(70vh,520px)] lg:h-auto lg:min-h-[420px] lg:flex-1"
        />
      </section>
    );
  }

  return (
    <section aria-label="生成过程与结果" className={cn("plate overflow-hidden", !result && "flex flex-col lg:absolute lg:inset-0")}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3">
        <span className="label-caps">{state.status === "done" ? "Fig. 1 · 完成" : state.status === "error" ? (result ? "未完成" : "失败") : state.status === "stopped" ? "已停止" : "工作中"}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{result?.title || state.job?.prompt}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          <Elapsed from={state.startedAt} to={state.finishedAt} running={running} /> · 第 {state.turn}/{state.maxTurns} 轮 · ↑{fmtTokens(state.usage.input + state.usage.cacheRead + state.usage.cacheWrite)} ↓{fmtTokens(state.usage.output)}
        </span>
      </header>
      {running && <Progress value={state.maxTurns ? (state.turn / state.maxTurns) * 100 : 0} className="h-0.5 rounded-none" aria-label="轮数进度" />}

      {result ? (
        <div>
          {(state.status === "error" || state.status === "stopped") && (
            <div role="status" className="flex flex-wrap items-center gap-3 border-b bg-signal/10 px-5 py-3 text-sm">
              <span className="min-w-0 flex-1 break-words">
                <strong className="font-medium">未完成：</strong>
                {state.error}。下面是目前做到的最新页面，可以预览、下载，或点「继续」接着做。
              </span>
              {canRevise && (
                <Button size="sm" onClick={() => onRevise("从中断的地方继续，完成检查与修正，然后调用 finish。")}>
                  <PlayIcon />
                  继续
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcwIcon />
                重新开始
              </Button>
            </div>
          )}
          <FigureFrame title={result.title || "生成的图解"} html={result.html} className="h-[min(72vh,720px)]" />
          <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <p className="mr-auto min-w-0 max-w-xl text-sm text-ink-soft">{result.summary || "图解已生成。"}</p>
            <Button variant="outline" onClick={() => openInTab(result.html, result.title)}>
              <ExternalLinkIcon />
              新标签打开
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button />}>
                <DownloadIcon />
                下载
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem onClick={() => download(baseName(result.page), result.page.endsWith(".html") ? result.html : result.files[result.page] ?? result.html, mimeOf(result.page))}>
                  <FileIcon />
                  {baseName(result.page)}
                </DropdownMenuItem>
                {Object.keys(result.files).filter((key) => key !== result.page).length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                    <DropdownMenuLabel>源文件</DropdownMenuLabel>
                    {Object.entries(result.files)
                      .filter(([key]) => key !== result.page)
                      .map(([key, data]) => (
                        <DropdownMenuItem key={key} onClick={() => download(baseName(key), data, mimeOf(key))}>
                          <FileIcon />
                          <span className="font-mono text-xs">{key.replace(/^work\/[^/]+\//, "")}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {canRevise && <ReviseBar onRevise={onRevise} />}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col border-b p-3 lg:border-b-0 lg:border-r">
            <div className="label-caps mb-2 px-2">工作日志</div>
            <RunLog items={state.items} waitingSince={state.waitingSince} className="lg:max-h-none lg:min-h-0 lg:flex-1" />
            {(state.status === "error" || state.status === "stopped") && (
              <div className="m-2 flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <span className="min-w-0 flex-1 break-words">{state.error}</span>
                {canRevise && (
                  <Button size="sm" onClick={() => onRevise("从中断的地方继续，完成图解并调用 finish。")}>
                    <PlayIcon />
                    继续
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={onRetry}>
                  <RotateCcwIcon />
                  重新开始
                </Button>
              </div>
            )}
          </div>
          <div className={cn("min-h-0 min-w-0 p-3 lg:overflow-y-auto", theme === "dark" ? "bg-[#161614]" : "bg-background")}>
            <div className="label-caps mb-2 px-2">检查台 · 实时</div>
            {stage && <StageView stage={stage} />}
            {state.lastShot && lastShot ? (
              <figure className="mt-2">
                <img src={lastShot} alt="最近一张检查截图" decoding="async" className="w-full rounded border bg-paper" />
                <figcaption className="mt-1 px-1 font-mono text-[11px] text-muted-foreground">{state.lastShot.key}</figcaption>
              </figure>
            ) : (
              <p className="px-2 py-10 text-center text-sm text-muted-foreground">构思物件、编写几何中。第一次截图检查时，页面会出现在这里。</p>
            )}
          </div>
        </div>
      )}
      {result && state.items.length > 0 && (
        <details className="border-t px-5 py-3">
          <summary className="label-caps cursor-pointer select-none">工作日志 · {state.items.filter((i) => i.kind === "tool").length} 步</summary>
          <div className="mt-2">
            <RunLog items={state.items} />
          </div>
        </details>
      )}
    </section>
  );
});
