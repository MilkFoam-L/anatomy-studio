import { memo } from "react";
import { MoonIcon, Settings2Icon, SunIcon } from "lucide-react";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TopBarProps {
  configured: boolean;
  model: string;
  host: string;
  onSettings: () => void;
}

/** Wordmark glyph: an isometric block, the skill's basic solid. */
function Glyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
      <path d="M12 3 20 7.5 12 12 4 7.5Z" className="fill-paper stroke-foreground" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4 7.5 12 12v9l-8-4.5Z" className="fill-muted stroke-foreground" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M20 7.5 12 12v9l8-4.5Z" className="fill-foreground/80 stroke-foreground" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="12" cy="7.5" r="1.1" className="fill-signal" />
    </svg>
  );
}

export const TopBar = memo(function TopBar({ configured, model, host, onSettings }: TopBarProps) {
  const [scheme, setScheme] = useColorScheme();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Glyph />
          <span className="text-[15px] font-semibold tracking-tight max-[359px]:sr-only">Anatomy Studio</span>
        </a>
        <nav aria-label="主导航" className="hidden items-center gap-1 sm:flex">
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href="#gallery" />}>画廊</Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href="#history" />}>我的图解</Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer" />}>Skill 源码</Button>
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="切换明暗" onClick={() => setScheme(scheme === "dark" ? "light" : "dark")} />}>
              {scheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </TooltipTrigger>
            <TooltipContent>切换明暗</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={onSettings} className="min-w-0 max-w-64 shrink" aria-label="接口设置">
            <span className={cn("size-1.5 shrink-0 rounded-full", configured ? "bg-emerald-500" : "bg-signal animate-pulse")} aria-hidden="true" />
            <span className="truncate font-mono text-xs">
              {configured ? (
                <>
                  {model}
                  <span className="hidden md:inline"> · {host}</span>
                </>
              ) : (
                "设置接口"
              )}
            </span>
            <Settings2Icon />
          </Button>
        </div>
      </div>
    </header>
  );
});
