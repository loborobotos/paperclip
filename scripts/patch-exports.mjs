/**
 * patch-exports.mjs
 *
 * Swaps workspace package.json exports from src/ (tsx dev mode)
 * to dist/ (production mode), simulating what `npm publish` does
 * via publishConfig. Run this after `pnpm -r build` in Docker.
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const files = execSync(
  "find . -name package.json -not -path '*/node_modules/*' -not -path '*/dist/*'",
  { encoding: "utf8" }
)
  .trim()
  .split("\n")
  .filter(Boolean);

let patched = 0;
for (const f of files) {
  try {
    const pkg = JSON.parse(readFileSync(f, "utf8"));
    if (pkg.publishConfig?.exports) {
      pkg.exports = pkg.publishConfig.exports;
      if (pkg.publishConfig.main) pkg.main = pkg.publishConfig.main;
      if (pkg.publishConfig.types) pkg.types = pkg.publishConfig.types;
      writeFileSync(f, JSON.stringify(pkg, null, 2) + "\n");
      console.log("patched:", f);
      patched++;
    }
  } catch (_) {}
}

console.log(`\nDone — patched ${patched} packages`);
