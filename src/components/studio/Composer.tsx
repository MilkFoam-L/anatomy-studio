import { memo, useState } from "react";
import { ArrowUpRightIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QUALITY, type JobOptions, type OutputKind, type Quality, type Theme } from "@/agent/prompt";
import { Segmented } from "./Segmented";

const EXAMPLES = [
  { tag: "限流", text: "解释令牌桶限流：桶容量 20 个令牌，每秒补充 5 个，每个请求消耗 1 个，桶空时请求被拒绝。要可以交互。" },
  { tag: "连接池", text: "数据库连接池：池里有 10 个连接，请求借走一个用完归还；10 个都忙时，新请求在队列里等待。" },
  { tag: "缓存", text: "CDN 边缘缓存怎么工作：缓存命中与未命中的区别，TTL 为 60 秒。" },
  { tag: "咖啡机", text: "一台拆掉侧板的热交换式意式咖啡机：锅炉、热交换管、冲泡头、水泵、蒸汽管和压力表，萃取时水流动起来。" },
  { tag: "本生灯", text: "实验台上的本生灯：打开空气调节环，懒散的黄色火焰变成呼啸的蓝色锥焰，火焰用 WebGL。" },
];

interface ComposerProps {
  running: boolean;
  onSubmit: (job: JobOptions) => void;
  onStop: () => void;
}

export const Composer = memo(function Composer({ running, onSubmit, onStop }: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [output, setOutput] = useState<OutputKind>("html");
  const [quality, setQuality] = useState<Quality>("standard");
  const ready = prompt.trim().length >= 4 && !running;

  const submit = () => {
    if (ready) onSubmit({ prompt: prompt.trim(), theme, output, quality });
  };

  return (
    <section aria-labelledby="composer-title" className="plate corner-ticks flex flex-col p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 id="composer-title" className="label-caps">Fig. 0 · 新建图解</h2>
        <span className="label-caps hidden sm:inline">Anatomy skill</span>
      </div>

      <label htmlFor="prompt" className="mt-5 block text-[15px] font-medium leading-snug text-ink-soft">
        说出你想讲清楚的概念，给出真实的数字。
        <span className="text-muted-foreground"> 它会发明一台能“演示”这个概念的机械，并把它画出来。</span>
      </label>
      <Textarea
        id="prompt"
        value={prompt}
        disabled={running}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="例如：解释令牌桶限流，桶容量 20，每秒补充 5 个……"
        className="mt-3 min-h-36 resize-y bg-background text-[15px] leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="示例">
        {EXAMPLES.map((example) => (
          <button
            key={example.tag}
            type="button"
            disabled={running}
            onClick={() => setPrompt(example.text)}
            className="rounded-full border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {example.tag}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3 border-t pt-5">
        <Segmented<Theme> label="主题" value={theme} onChange={setTheme} disabled={running} options={[{ value: "light", label: "亮色" }, { value: "dark", label: "暗色" }]} />
        <Segmented<OutputKind> label="输出" value={output} onChange={setOutput} disabled={running} options={[{ value: "html", label: "HTML 页面" }, { value: "svg", label: "SVG 文件" }]} />
        <Segmented<Quality>
          label="精度"
          value={quality}
          onChange={setQuality}
          disabled={running}
          options={(Object.keys(QUALITY) as Quality[]).map((q) => ({ value: q, label: QUALITY[q].label, hint: `最多约 ${QUALITY[q].rounds} 轮，${QUALITY[q].eta}` }))}
        />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          {QUALITY[quality].eta} · <kbd className="rounded border px-1">⌘</kbd>
          <kbd className="ml-0.5 rounded border px-1">↵</kbd> 生成
        </p>
        {running ? (
          <Button variant="outline" size="lg" onClick={onStop}>
            <SquareIcon className="fill-current" />
            停止
          </Button>
        ) : (
          <Button size="lg" disabled={!ready} onClick={submit} className="px-4">
            生成图解
            <ArrowUpRightIcon />
          </Button>
        )}
      </div>
    </section>
  );
});
