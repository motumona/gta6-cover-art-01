import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

// Vice Coast Cover Studio — entry program for make.fun gta6-cover-art-01.
// Copies the static app and the screenshots into the output directory
// and writes the dossier the gate and the judge read. Node 22,
// standard library only; no network, no installs.

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outputDir, { recursive: true });

const appSource = join(repoRoot, "app");
const appTarget = join(outputDir, "app");
cpSync(appSource, appTarget, { recursive: true });

const screenshotsSource = join(repoRoot, "screenshots");
const screenshotsTarget = join(outputDir, "screenshots");
mkdirSync(screenshotsTarget, { recursive: true });
if (existsSync(screenshotsSource)) {
  cpSync(screenshotsSource, screenshotsTarget, { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, "dossier.json"), dossier);

console.log(`Vice Coast Cover Studio handed in to ${outputDir}`);
