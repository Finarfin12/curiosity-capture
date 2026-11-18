import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await build({ entryPoints: ["src/background.ts", "src/capture.ts"], outdir: "dist",
  bundle: true, format: "iife", target: "chrome114", platform: "browser" });
await Promise.all(["manifest.json", "capture.html", "capture.css"].map(name => copyFile(name, "dist/" + name)));
