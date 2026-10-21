import { useCallback, useSyncExternalStore } from "react";

// The page's own light/dark choice. index.html applies it before first paint.
const KEY = "anatomy-studio.theme";
type Scheme = "light" | "dark";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function stored(): Scheme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function current(): Scheme {
  return stored() ?? (media().matches ? "dark" : "light");
}

function apply() {
  document.documentElement.classList.toggle("dark", current() === "dark");
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = media();
  mq.addEventListener("change", apply);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", apply);
  };
}

export function useColorScheme(): [Scheme, (scheme: Scheme) => void] {
  const scheme = useSyncExternalStore(subscribe, current, () => "light" as Scheme);
  const set = useCallback((next: Scheme) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Without storage the choice lasts until reload.
      document.documentElement.classList.toggle("dark", next === "dark");
      return;
    }
    apply();
  }, []);
  return [scheme, set];
}
