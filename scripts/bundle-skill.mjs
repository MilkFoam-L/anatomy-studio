// Packs the Anatomy skill (git submodule) into a JSON file the browser loads as its
// read-only file system, and copies the prebuilt example pages into the gallery.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "vendor/anatomy");
const OUT = join(ROOT, "public/skill");
const GALLERY = join(ROOT, "public/gallery");

if (!existsSync(join(SKILL, "SKILL.md"))) {
  console.error("vendor/anatomy is missing. Run: git submodule update --init");
  process.exit(1);
}

const TEXT = new Set([".md", ".mjs", ".js", ".ts", ".tsx", ".css", ".json"]);
const SKIP_DIRS = new Set([".git", ".github", "tests", "node_modules"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : walk(path);
    return [path];
  });
}

const wanted = (rel) => {
  if (rel.endsWith(".test.mjs")) return false;
  if (rel === "LICENSE") return true;
  return TEXT.has(extname(rel));
};

const files = {};
for (const path of walk(SKILL)) {
  const rel = relative(SKILL, path).split("\\").join("/");
  if (wanted(rel)) files[rel] = readFileSync(path, "utf8");
}

let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", SKILL, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  // Not a git checkout (e.g. a downloaded archive); the version stays unknown.
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "bundle.json"), JSON.stringify({ commit, files }));

mkdirSync(GALLERY, { recursive: true });
const gallery = [];
for (const name of readdirSync(join(SKILL, "examples")).sort()) {
  const dir = join(SKILL, "examples", name);
  for (const theme of ["light", "dark"]) {
    const file = theme === "light" ? `${name}-light.html` : `${name}.html`;
    if (!existsSync(join(dir, file))) continue;
    copyFileSync(join(dir, file), join(GALLERY, file));
    gallery.push({ name, theme, file });
  }
}
writeFileSync(join(GALLERY, "index.json"), JSON.stringify(gallery));

const size = Object.values(files).reduce((sum, text) => sum + text.length, 0);
console.log(`skill ${commit}: ${Object.keys(files).length} files, ${(size / 1024).toFixed(0)} KB; gallery ${gallery.length} pages`);
