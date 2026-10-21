// Static assets produced by scripts/bundle-skill.mjs and scripts/build-runtime.mjs.
const base = import.meta.env.BASE_URL;

export interface SkillBundle {
  commit: string;
  files: Record<string, string>;
}

export interface GalleryItem {
  name: string;
  theme: "light" | "dark";
  file: string;
}

const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load().catch((error) => {
    cache.delete(key);
    throw error;
  }));
  return cache.get(key) as Promise<T>;
}

async function fetchOk(path: string): Promise<Response> {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  return response;
}

export const loadSkill = () => once("skill", async () => (await fetchOk("skill/bundle.json")).json() as Promise<SkillBundle>);
export const loadGallery = () => once("gallery", async () => (await fetchOk("gallery/index.json")).json() as Promise<GalleryItem[]>);
export const loadStageAgent = () => once("agent", async () => (await fetchOk("runtime/stage-agent.js")).text());
export const loadNodeWorker = () => once("worker", async () => (await fetchOk("runtime/node-worker.js")).text());
export const galleryUrl = (file: string) => `${base}gallery/${file}`;
