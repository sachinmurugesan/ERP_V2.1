#!/usr/bin/env tsx
/**
 * generate.ts
 *
 * Runs openapi-typescript to produce src/generated/types.ts from the
 * committed openapi.json snapshot.
 *
 * Run after fetch-spec.ts whenever backend endpoints change:
 *   pnpm --filter @harvesterp/sdk generate
 *
 * The generate script is intentionally separate from fetch-spec so that
 * offline regeneration (from the committed snapshot) is always possible:
 *   npx tsx scripts/generate.ts
 */

import { execSync } from "node:child_process";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPEC_PATH = resolve(__dirname, "../openapi.json");
const OUT_PATH  = resolve(__dirname, "../src/generated/types.ts");

function main(): void {
  if (!existsSync(SPEC_PATH)) {
    console.error(
      `ERROR: ${SPEC_PATH} not found — run 'pnpm fetch-spec' first`,
    );
    process.exit(1);
  }

  console.log(`Generating types from ${SPEC_PATH} …`);
  const start = Date.now();

  try {
    execSync(
      `npx openapi-typescript "${SPEC_PATH}" --output "${OUT_PATH}"`,
      { stdio: "inherit", cwd: resolve(__dirname, "..") },
    );
  } catch (err) {
    console.error("ERROR: openapi-typescript failed");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const bytes = statSync(OUT_PATH).size;
  const lines = readFileSync(OUT_PATH, "utf-8").split("\n").length;

  console.log(`✓ Generated ${OUT_PATH}`);
  console.log(`  Size:    ${(bytes / 1024).toFixed(0)} KB / ${lines.toLocaleString()} lines`);
  console.log(`  Elapsed: ${elapsed}s`);
}

main();
