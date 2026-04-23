#!/usr/bin/env tsx
/**
 * fetch-spec.ts
 *
 * Downloads the FastAPI OpenAPI spec from the running backend and writes it
 * to packages/sdk/openapi.json (pretty-printed, keys sorted for stable diffs).
 *
 * Usage:
 *   pnpm --filter @harvesterp/sdk fetch-spec
 *   FASTAPI_URL=http://myhost:8000 pnpm --filter @harvesterp/sdk fetch-spec
 *
 * Exit 0 on success, non-zero on failure.
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env["FASTAPI_URL"] ?? "http://localhost:8000";
const SPEC_URL = `${BASE_URL}/openapi.json`;
const OUT_PATH = resolve(__dirname, "../openapi.json");

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return obj;
}

async function main(): Promise<void> {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL} …`);

  let spec: unknown;
  try {
    const res = await fetch(SPEC_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    spec = await res.json();
  } catch (err) {
    console.error(`ERROR: Failed to fetch ${SPEC_URL}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (
    typeof spec !== "object" ||
    spec === null ||
    !("paths" in spec)
  ) {
    console.error(
      "ERROR: Response does not look like an OpenAPI spec (no 'paths' key)",
    );
    process.exit(1);
  }

  const paths = (spec as { paths: Record<string, unknown> }).paths;
  const pathCount = Object.keys(paths).length;

  if (pathCount === 0) {
    console.warn(
      "WARNING: Spec contains 0 paths — this may indicate an empty or malformed spec",
    );
    process.exit(1);
  }

  const sorted = sortKeys(spec);
  writeFileSync(OUT_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf-8");

  const infoBlock = (spec as Record<string, unknown>)["info"] as
    | Record<string, unknown>
    | undefined;

  console.log(`✓ Written ${OUT_PATH}`);
  console.log(
    `  OpenAPI: ${(spec as Record<string, unknown>)["openapi"] ?? "??"}`,
  );
  console.log(`  Paths:   ${pathCount}`);
  console.log(`  Title:   ${infoBlock?.["title"] ?? "??"}`);
}

main();
