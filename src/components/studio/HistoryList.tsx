import { memo } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/lib/history";

interface HistoryListProps {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
}

const date = (ms: number) => new Date(ms).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const HistoryList = memo(function HistoryList({ entries, onOpen, onDelete }: HistoryListProps) {
  if (!entries.length) return null;
  return (
    <section id="history" aria-labelledby="history-title" className="scroll-mt-20">
      <h2 id="history-title" className="text-xl font-semibold tracking-tight">我的图解</h2>
      <p className="mt-1 text-sm text-muted-foreground">只保存在这个浏览器里。</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.id} className="plate group relative overflow-hidden">
            <button type="button" onClick={() => onOpen(entry)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <div className="aspect-[16/10] overflow-hidden border-b bg-background">
                {entry.thumbnail ? <img src={entry.thumbnail} alt="" className="size-full object-contain" /> : <div className="grid size-full place-items-center label-caps">no preview</div>}
              </div>
              <div className="p-4 pr-12">
                <div className="truncate text-sm font-medium">{entry.title || entry.job.prompt}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {date(entry.createdAt)} · {entry.model} · {entry.turns} 轮
                </div>
              </div>
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="删除" className="absolute bottom-3 right-3 opacity-60 hover:opacity-100" onClick={() => onDelete(entry)}>
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
});
