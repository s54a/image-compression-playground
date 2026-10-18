import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the package entry instead of relying on an unexported package subpath.
const entry = fileURLToPath(import.meta.resolve("browser-image-compression"));
const destination = new URL("../public/vendor/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  join(dirname(entry), "browser-image-compression.js"),
  new URL("browser-image-compression.js", destination),
);
