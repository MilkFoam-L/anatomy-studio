import { useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { withCsp } from "@/stage/stage";

interface FigureFrameProps {
  title: string;
  html?: string;
  src?: string;
  className?: string;
}

/**
 * Shows a figure page in an opaque-origin sandbox: it can run its own scripts but can
 * never reach the studio's storage, where the API key lives, nor (for generated pages)
 * the network.
 */
export function FigureFrame({ title, html, src, className }: FigureFrameProps) {
  const doc = useMemo(() => (html === undefined ? undefined : withCsp(html)), [html]);
  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={doc}
      src={doc === undefined ? src : undefined}
      loading="lazy"
      className={cn("block w-full border-0 bg-transparent", className)}
    />
  );
}

interface FittedFigureFrameProps extends FigureFrameProps {
  /** The smallest viewport the page lays out in without scrolling. */
  minWidth: number;
  minHeight: number;
}

/**
 * A figure page shown whole: the frame fills its parent, and when the parent is smaller
 * than the page needs, the page gets a larger viewport and is scaled down to fit instead
 * of scrolling inside the card.
 */
export function FittedFigureFrame({ minWidth, minHeight, className, ...frame }: FittedFigureFrameProps) {
  const outer = useRef<HTMLDivElement>(null);

  // Sized straight on the DOM before the first paint and on every resize, so the page
  // never shows at the wrong scale and resizing does not re-render (or reload) it.
  useLayoutEffect(() => {
    const box = outer.current;
    const iframe = box?.firstElementChild as HTMLIFrameElement | null;
    if (!box || !iframe) return;
    const fit = () => {
      // Layout size, not getBoundingClientRect: an ancestor's transform (a dialog's zoom-in)
      // would otherwise be baked into the scale.
      const { offsetWidth: width, offsetHeight: height } = box;
      const scale = Math.min(1, width / minWidth, height / minHeight) || 1;
      iframe.style.width = `${width / scale}px`;
      iframe.style.height = `${height / scale}px`;
      iframe.style.transform = `scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [minWidth, minHeight]);

  return (
    <div ref={outer} className={cn("relative overflow-hidden", className)}>
      <FigureFrame {...frame} className="absolute left-0 top-0 origin-top-left" />
    </div>
  );
}
