/**
 * Discovers and runs every `*.test.ts` under `__tests__/` as an isolated
 * subprocess. A test file that exits non-zero does not halt sibling test
 * files — the runner collects the exit codes and returns its own non-zero
 * exit code if any test file failed.
 *
 * Invoked via `npm test`.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const dir = resolve("__tests__");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort();

if (files.length === 0) {
  console.error("no test files found under __tests__/");
  process.exit(1);
}

let anyFailed = false;
for (const f of files) {
  console.log(`\n── ${f} ───────────────────────────────`);
  const result = spawnSync("npx", ["tsx", join(dir, f)], {
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    anyFailed = true;
  }
}

console.log("");
if (anyFailed) {
  console.error("one or more test files failed");
  process.exit(1);
}
console.log("all test files passed");
