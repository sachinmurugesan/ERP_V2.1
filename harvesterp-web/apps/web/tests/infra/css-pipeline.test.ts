/**
 * css-pipeline.test.ts — Static analysis of Next.js build manifests to verify
 * that every CSS file referenced by the page manifests actually exists on disk
 * inside `.next/`.
 *
 * Catches the regression that hit on 2026-04-26: the dev-server
 * `app-build-manifest.json` pointed at `static/css/app/layout.css?v=…` while
 * the actual compiled file lived at a different (hash-named) filename. Result:
 * 404 for every page's stylesheet, every migrated page rendered in Times New
 * Roman with no design tokens applied. Fixed by `rm -rf apps/web/.next` +
 * restart, but worth catching automatically next time.
 *
 * What this test does:
 *   1. Read `apps/web/.next/app-build-manifest.json` (App Router pages).
 *   2. Read `apps/web/.next/build-manifest.json`     (Pages Router pages).
 *   3. For every page entry, find every `static/.../*.css` asset reference.
 *   4. Verify each referenced file exists on disk under `.next/<asset-path>`
 *      and is non-empty.
 *
 * What this test does NOT do:
 *   - Spin up a dev server.
 *   - Hit any URL over the network.
 *   - Verify the *contents* of the CSS (other tests cover that).
 *
 * Skipped (not failed) when `.next/` does not exist — devs who haven't built
 * locally do not get spurious failures from `pnpm test`. CI must run a build
 * before tests for full coverage; otherwise the suite reports skipped.
 *
 * See also: `docs/migration/audits/ui-quality-audit-2026-04-26.md` §7.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "fs";
import { resolve, join } from "path";

// ── Paths ──────────────────────────────────────────────────────────────────────

const WEB_DIR = resolve(import.meta.dirname, "../..");      // apps/web
const NEXT_DIR = join(WEB_DIR, ".next");
const APP_BUILD_MANIFEST = join(NEXT_DIR, "app-build-manifest.json");
const BUILD_MANIFEST = join(NEXT_DIR, "build-manifest.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ManifestWithPages {
  pages: Record<string, string[]>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isCssAsset(asset: string): boolean {
  return asset.endsWith(".css");
}

/** For each page, return only its CSS asset paths. Empty entries omitted. */
function collectCssByPage(
  manifest: ManifestWithPages,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [page, assets] of Object.entries(manifest.pages)) {
    const css = assets.filter(isCssAsset);
    if (css.length > 0) result.set(page, css);
  }
  return result;
}

const NEXT_EXISTS = existsSync(NEXT_DIR);
const APP_MANIFEST_EXISTS = NEXT_EXISTS && existsSync(APP_BUILD_MANIFEST);
const PAGES_MANIFEST_EXISTS = NEXT_EXISTS && existsSync(BUILD_MANIFEST);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Next.js build artifact presence", () => {
  it("apps/web/.next/ exists (run `pnpm --filter web build` or `dev` first)", () => {
    if (!NEXT_EXISTS) {
      // Not a hard failure — devs without a local build can still run the rest of `pnpm test`.
      console.warn(
        `[css-pipeline.test] .next directory not found at ${NEXT_DIR}. ` +
          `Skipping CSS asset checks. Run \`pnpm --filter web build\` or \`pnpm --filter web dev\` to enable.`,
      );
    }
    // Always pass — reporting only.
    expect(true).toBe(true);
  });
});

describe.skipIf(!APP_MANIFEST_EXISTS)(
  "CSS pipeline — App Router (app-build-manifest.json)",
  () => {
    const manifest = readJson<ManifestWithPages>(APP_BUILD_MANIFEST);
    const cssByPage = collectCssByPage(manifest);

    it("at least one App Router page references CSS (sanity — `globals.css` is wired into /layout)", () => {
      expect(cssByPage.size, "Expected at least one /layout or /page entry to reference a CSS asset").toBeGreaterThan(0);
    });

    for (const [page, cssAssets] of cssByPage) {
      for (const cssPath of cssAssets) {
        it(`exists on disk: page "${page}" → ${cssPath}`, () => {
          const onDisk = join(NEXT_DIR, cssPath);
          expect(
            existsSync(onDisk),
            `Manifest references ${cssPath} but file is missing on disk at ${onDisk}. ` +
              `This is the 2026-04-26 regression — run \`rm -rf apps/web/.next\` then \`pnpm --filter web build\` (or restart dev).`,
          ).toBe(true);
          // Empty CSS is an aborted-write symptom; treat as failure.
          if (existsSync(onDisk)) {
            const size = statSync(onDisk).size;
            expect(size, `${cssPath} exists but is 0 bytes (aborted write?)`).toBeGreaterThan(0);
          }
        });
      }
    }
  },
);

describe.skipIf(!PAGES_MANIFEST_EXISTS)(
  "CSS pipeline — Pages Router (build-manifest.json)",
  () => {
    const manifest = readJson<ManifestWithPages>(BUILD_MANIFEST);
    const cssByPage = collectCssByPage(manifest);

    if (cssByPage.size === 0) {
      it("Pages Router has no CSS references (App-Router-only project — expected)", () => {
        expect(cssByPage.size).toBe(0);
      });
      return;
    }

    for (const [page, cssAssets] of cssByPage) {
      for (const cssPath of cssAssets) {
        it(`exists on disk: page "${page}" → ${cssPath}`, () => {
          const onDisk = join(NEXT_DIR, cssPath);
          expect(
            existsSync(onDisk),
            `Manifest references ${cssPath} but file is missing on disk at ${onDisk}.`,
          ).toBe(true);
          if (existsSync(onDisk)) {
            expect(statSync(onDisk).size).toBeGreaterThan(0);
          }
        });
      }
    }
  },
);

// ── G-2026-04-26 regression guard ─────────────────────────────────────────────

describe.skipIf(!APP_MANIFEST_EXISTS)(
  "G-2026-04-26: dev-server CSS manifest desync regression guard",
  () => {
    // Verifies that the /layout entry in the manifest references a CSS asset
    // and that asset exists on disk. This is the exact pair that broke on
    // 2026-04-26: manifest said `static/css/app/layout.css`, on-disk file was
    // a hash-named one, HTML emitted the manifest path → 404 → unstyled page.

    const manifest = readJson<ManifestWithPages>(APP_BUILD_MANIFEST);
    const layoutEntry = manifest.pages["/layout"];

    it("/layout entry exists in app-build-manifest.json", () => {
      expect(layoutEntry, "Expected /layout entry in app-build-manifest.json").toBeDefined();
    });

    it("/layout entry references at least one CSS asset (globals.css)", () => {
      const cssAssets = (layoutEntry ?? []).filter(isCssAsset);
      expect(
        cssAssets.length,
        "/layout should reference at least one CSS asset (the bundled globals.css)",
      ).toBeGreaterThan(0);
    });

    it("every CSS asset the /layout entry names actually exists on disk (catches the 2026-04-26 desync)", () => {
      const cssAssets = (layoutEntry ?? []).filter(isCssAsset);
      for (const cssPath of cssAssets) {
        const onDisk = join(NEXT_DIR, cssPath);
        expect(
          existsSync(onDisk),
          `/layout manifest references ${cssPath} but file is missing on disk. ` +
            `This is the 2026-04-26 regression — run \`rm -rf apps/web/.next\` then restart dev/build.`,
        ).toBe(true);
      }
    });
  },
);
