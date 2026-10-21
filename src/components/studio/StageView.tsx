import { useLayoutEffect, useRef } from "react";
import type { Stage, StageSize } from "@/stage/stage";

/**
 * Hosts the stage iframe (the page under test, at its own viewport size) and scales it
 * to fit. It stays on screen on purpose: hidden cross-origin frames stop animating.
 * Sizing is applied straight to the DOM, in step with the stage swapping pages, so a
 * new page never paints unscaled and the view never waits on a React render.
 */
export function StageView({ stage }: { stage: Stage }) {
  const outer = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const inner = host.current;
    if (!box || !inner) return;
    let size: StageSize | null = null;
    const fit = (next?: StageSize | null) => {
      if (next !== undefined) size = next;
      const scale = size ? box.clientWidth / size.width : 0;
      box.style.height = size ? `${size.height * scale}px` : "0px";
      inner.style.width = size ? `${size.width}px` : "0px";
      inner.style.height = size ? `${size.height}px` : "0px";
      inner.style.transform = `scale(${scale})`;
    };
    stage.mount(inner, fit);
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    return () => {
      observer.disconnect();
      stage.mount(null);
    };
  }, [stage]);

  return (
    <div ref={outer} className="relative w-full overflow-hidden" style={{ height: 0 }}>
      <div ref={host} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 origin-top-left" />
    </div>
  );
}
