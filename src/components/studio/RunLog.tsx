import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrainIcon, CameraIcon, CheckIcon, ChevronRightIcon, FileCode2Icon, FilePenIcon, FolderTreeIcon, HammerIcon, Loader2Icon, PackageCheckIcon, RulerIcon, SearchIcon, TerminalIcon, TriangleAlertIcon, XIcon, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { LogItem, Shot } from "@/hooks/useRun";
import { cn } from "@/lib/utils";

const str = (value: unknown) => (typeof value === "string" ? value : "");
const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

function describe(item: Extract<LogItem, { kind: "tool" }>): { icon: LucideIcon; title: string; detail: string } {
  const input = item.input ?? {};
  switch (item.name) {
    case "read_file":
      return { icon: FileCode2Icon, title: "读取", detail: str(input.path) };
    case "write_file":
      return { icon: FilePenIcon, title: item.status === "writing" ? "正在写入" : "写入", detail: str(input.path) || kb(item.bytes) };
    case "edit_file":
      return { icon: FilePenIcon, title: "修改", detail: str(input.path) };
    case "list_files":
      return { icon: FolderTreeIcon, title: "浏览", detail: str(input.path) || "/" };
    case "grep":
      return { icon: SearchIcon, title: "搜索", detail: str(input.pattern) };
    case "finish":
      return { icon: PackageCheckIcon, title: "交付", detail: str(input.page) };
    case "run": {
      const command = str(input.command);
      if (/scripts\/(capture|drive)\.mjs/.test(command)) return { icon: CameraIcon, title: "截图检查", detail: command };
      if (/scripts\/lines\.mjs/.test(command)) return { icon: RulerIcon, title: "线端检查", detail: command };
      if (/--audit/.test(command)) return { icon: RulerIcon, title: "几何审计", detail: command };
      if (/build\.mjs/.test(command)) return { icon: HammerIcon, title: "构建", detail: command };
      return { icon: TerminalIcon, title: "运行", detail: command };
    }
    default:
      return { icon: TerminalIcon, title: item.name, detail: "" };
  }
}

const ToolRow = memo(function ToolRow({ item, onShot }: { item: Extract<LogItem, { kind: "tool" }>; onShot: (shot: Shot) => void }) {
  const { icon: Icon, title, detail } = describe(item);
  const active = item.status === "writing" || item.status === "running";
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger
          disabled={!item.output}
          className="group/trigger flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring disabled:hover:bg-transparent"
        >
          <span className={cn("grid size-6 shrink-0 place-items-center rounded border bg-background", active && "border-signal/50 text-signal")}>
            {active ? <Loader2Icon className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
          </span>
          <span className="shrink-0 font-medium">{title}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{detail}</span>
          {item.status === "writing" && item.bytes > 0 && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{kb(item.bytes)}</span>}
          {item.status === "done" && <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />}
          {item.status === "error" && <XIcon className="size-3.5 shrink-0 text-destructive" />}
          {item.output && <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/trigger:rotate-90" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mx-2 mb-2 mt-1 max-h-72 overflow-auto rounded-md border bg-background p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-soft">{item.output}</pre>
        </CollapsibleContent>
      </Collapsible>
      {item.shots.length > 0 && (
        <div className="mb-2 ml-10 mt-1 flex flex-wrap gap-2">
          {item.shots.map((shot) => (
            <button
              key={shot.url}
              type="button"
              onClick={() => onShot(shot)}
              className="overflow-hidden rounded border bg-background transition hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`查看截图 ${shot.key}`}
            >
              <img src={shot.url} alt="" className="h-20 w-auto max-w-56 object-contain" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
});

/** Every row but the newest keeps its item object, so only the row that changed renders. */
const Row = memo(function Row({ item, onShot }: { item: LogItem; onShot: (shot: Shot) => void }) {
  if (item.kind === "tool") return <ToolRow item={item} onShot={onShot} />;
  if (item.kind === "text") return <li className="px-2 py-2 text-[14px] leading-relaxed whitespace-pre-wrap">{item.text.trim()}</li>;
  if (item.kind === "thinking")
    return (
      <li className="flex items-center gap-2 px-2 py-1 font-mono text-[11px] text-muted-foreground">
        <BrainIcon className="size-3.5" /> 思考 · {item.text.length} 字
      </li>
    );
  return (
    <li className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-xs", item.tone === "warn" ? "bg-signal/10 text-signal" : "bg-muted text-muted-foreground")}>
      <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
      {item.text}
    </li>
  );
});

function Waiting({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return (
    <li className="flex items-center gap-2.5 px-2 py-2 text-sm text-muted-foreground">
      <span className="relative grid size-6 place-items-center">
        <span className="absolute size-2 animate-ping rounded-full bg-signal/50" />
        <span className="size-2 rounded-full bg-signal" />
      </span>
      模型思考中 · 已等待 <span className="font-mono tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>
      {s > 90 && <span className="text-xs">（较长的轮次通常是在一次性写整份构建脚本）</span>}
    </li>
  );
}

export const RunLog = memo(function RunLog({ items, waitingSince = null, className }: { items: LogItem[]; waitingSince?: number | null; className?: string }) {
  const [shot, setShot] = useState<Shot | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [items, waitingSince]);

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className={cn("max-h-[28rem] overflow-y-auto pr-1", className)}
        aria-live="polite"
      >
        {items.length === 0 && waitingSince === null ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">正在加载 skill 与运行环境…</p>
        ) : (
          <ol className="grid grid-cols-1 gap-0.5">
            {items.map((item) => (
              <Row key={item.id} item={item} onShot={setShot} />
            ))}
            {waitingSince !== null && <Waiting since={waitingSince} />}
          </ol>
        )}
      </div>
      <Dialog open={shot !== null} onOpenChange={(open) => !open && setShot(null)}>
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-5xl">
          <DialogTitle className="font-mono text-xs font-normal text-muted-foreground">{shot?.key}</DialogTitle>
          {shot && <img src={shot.url} alt={`截图 ${shot.key}`} className="w-full rounded border" />}
        </DialogContent>
      </Dialog>
    </>
  );
});
