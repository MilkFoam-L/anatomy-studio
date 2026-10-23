import { memo, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { galleryUrl, loadGallery, type GalleryItem } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { FigureFrame, FittedFigureFrame } from "./FigureFrame";
import { Segmented } from "./Segmented";

const THUMBS = import.meta.glob<string>("../../assets/thumbs/*.jpg", { eager: true, import: "default" });
const thumbOf = (file: string) => THUMBS[`../../assets/thumbs/${file.replace(/\.html$/, ".jpg")}`];

const NOTES: Record<string, string> = {
  "dial-indicator": "最小的示例：表盘指示器读出每块量块的高度。",
  "desk-computer": "1984 年风格的台式电脑，键盘可以打字。",
  "arcade-cabinet": "拆掉侧板的街机：投币、脉冲沿线缆传到主板。",
  "raptor-engine": "Raptor 2 发动机试车台，可拆解成 11 个组件，WebGL 尾焰。",
  "ripple-tank": "水波槽：两个振子产生干涉，WebGL 焦散投在纸屏上。",
  "turning-dial": "3D 模式：真实转动的密码盘和机械手。",
  "push-button": "按钮与弹簧的力学小样。",
};

// Smallest viewport each example page lays out in without scrolling (its figure plus caption).
const PAGE_WIDTH = 800;
const PAGE_HEIGHTS: Record<string, number> = {
  "dial-indicator": 730,
  "desk-computer": 880,
  "arcade-cabinet": 1260,
  "raptor-engine": 1170,
  "ripple-tank": 1242,
  "turning-dial": 810,
  "push-button": 780,
};
const pageHeightOf = (name: string) => PAGE_HEIGHTS[name] ?? 1260;

export const Gallery = memo(function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    loadGallery().then(setItems).catch(() => setItems([]));
  }, []);

  const names = useMemo(() => [...new Set(items.map((i) => i.name))], [items]);
  const fileOf = (name: string) => items.find((i) => i.name === name && i.theme === theme)?.file ?? items.find((i) => i.name === name)?.file ?? "";

  if (!names.length) return null;
  return (
    <section id="gallery" aria-labelledby="gallery-title" className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="gallery-title" className="text-xl font-semibold tracking-tight">画廊</h2>
          <p className="mt-1 text-sm text-muted-foreground">Anatomy skill 自带的示例，全部可交互。点开查看大图。</p>
        </div>
        <div className="w-56">
          <Segmented label="主题" value={theme} onChange={setTheme} options={[{ value: "light", label: "亮" }, { value: "dark", label: "暗" }]} />
        </div>
      </div>
      <ul className="grid auto-rows-[220px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {names.map((name, index) => (
          <li key={name} className={cn(index === 0 && "sm:col-span-2 sm:row-span-2", index >= names.length - 2 && index >= 5 && "lg:col-span-2")}>
            <button
              type="button"
              onClick={() => setOpen(name)}
              className="plate group relative flex h-full w-full flex-col overflow-hidden text-left transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
                {thumbOf(fileOf(name)) ? (
                  <img src={thumbOf(fileOf(name))} alt="" loading="lazy" decoding="async" className="size-full object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
                ) : (
                  <FigureFrame title={name} src={galleryUrl(fileOf(name))} className="pointer-events-none absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50" />
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t px-4 py-2.5">
                <span className="shrink-0 whitespace-nowrap font-mono text-xs">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{NOTES[name] ?? ""}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="w-[min(96vw,1200px)] max-w-none p-0 sm:max-w-none">
          <div className="flex items-baseline gap-3 border-b px-5 py-3 pr-12">
            <DialogTitle className="font-mono text-sm">{open}</DialogTitle>
            <DialogDescription className="truncate text-xs">{open ? NOTES[open] : ""}</DialogDescription>
          </div>
          {open && (
            <div style={{ height: `min(84vh, ${pageHeightOf(open)}px)` }}>
              <FittedFigureFrame title={open} src={galleryUrl(fileOf(open))} minWidth={PAGE_WIDTH} minHeight={pageHeightOf(open)} className="size-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
});
