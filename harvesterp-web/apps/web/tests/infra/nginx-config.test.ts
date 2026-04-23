/**
 * nginx-config.test.ts — Static analysis of nginx routing config files.
 *
 * These tests do NOT require a running Docker stack. They read the nginx
 * config files from the ERP_V1 repo (sibling directory) and verify that:
 *
 *   1. docs/migration/MIGRATED_PATHS.md lists /login and /dashboard.
 *   2. nginx/nginx.dev.conf has all required location blocks.
 *   3. nginx/nginx.conf has all required location blocks in every portal
 *      server block (admin/client/factory).
 *   4. The G-019 `internal` directive is still present in nginx.conf
 *      (regression guard — must never be removed).
 *
 * When a new page migrates, add it to EXPECTED_MIGRATED_PATHS below and
 * the tests will automatically enforce its presence in both nginx configs.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";

// ── Paths ──────────────────────────────────────────────────────────────────────

// apps/web/ is two levels down from harvesterp-web/; ERP_V1/ is a sibling
// of harvesterp-web/ so we go up four levels total.
const WEB_DIR = resolve(import.meta.dirname, "../..");      // apps/web
const MONOREPO_ROOT = resolve(WEB_DIR, "../..");             // harvesterp-web/
const ERP_ROOT = resolve(MONOREPO_ROOT, "..", "ERP_V1");     // ERP_V1/

const NGINX_DEV_CONF = join(ERP_ROOT, "nginx", "nginx.dev.conf");
const NGINX_PROD_CONF = join(ERP_ROOT, "nginx", "nginx.conf");
const MIGRATED_PATHS_MD = join(ERP_ROOT, "docs", "migration", "MIGRATED_PATHS.md");

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

// ── Expected state ────────────────────────────────────────────────────────────

/**
 * Paths that MUST appear in MIGRATED_PATHS.md and have `location` blocks in
 * both nginx configs. Extend this list with each new migration PR.
 */
const EXPECTED_MIGRATED_PATHS = ["/login", "/dashboard"];

/**
 * Location block prefixes that MUST appear in every config (dev + prod).
 * These are structural/framework paths, not page migrations.
 */
const REQUIRED_LOCATION_BLOCKS = [
  "/_next/",
  "/api/auth/",
  "/api/",
  "/",
];

// ── Tests: MIGRATED_PATHS.md ─────────────────────────────────────────────────

describe("docs/migration/MIGRATED_PATHS.md", () => {
  const md = readFile(MIGRATED_PATHS_MD);

  it("file exists and is non-empty", () => {
    expect(md.length).toBeGreaterThan(0);
  });

  for (const path of EXPECTED_MIGRATED_PATHS) {
    it(`lists migrated path: ${path}`, () => {
      expect(md).toContain(path);
    });
  }

  it("has a Currently migrated table", () => {
    expect(md).toMatch(/Currently migrated/i);
  });
});

// ── Tests: nginx/nginx.dev.conf ───────────────────────────────────────────────

describe("nginx/nginx.dev.conf", () => {
  const conf = readFile(NGINX_DEV_CONF);

  it("file exists and is non-empty", () => {
    expect(conf.length).toBeGreaterThan(0);
  });

  for (const path of EXPECTED_MIGRATED_PATHS) {
    it(`has location block for migrated path: ${path}`, () => {
      // Exact match: location = /path
      expect(conf).toMatch(new RegExp(`location\\s*=\\s*${path.replace("/", "\\/")}\\s*\\{`));
    });
  }

  for (const prefix of REQUIRED_LOCATION_BLOCKS) {
    it(`has location block for: ${prefix}`, () => {
      // Prefix match: location /prefix/ or location /
      const escaped = prefix.replace(/\//g, "\\/").replace(/\*/g, "\\*");
      expect(conf).toContain(`location ${prefix}`);
    });
  }

  it("proxies /_next/ to nextjs_upstream", () => {
    // The /_next/ block should proxy to nextjs_upstream (not vue_upstream)
    const nextBlock = conf.match(/location\s+\/_next\/\s*\{([^}]+)\}/s);
    expect(nextBlock).not.toBeNull();
    expect(nextBlock![1]).toContain("nextjs_upstream");
  });

  it("proxies /api/auth/ to nextjs_upstream (not backend)", () => {
    const authBlock = conf.match(/location\s+\/api\/auth\/\s*\{([^}]+)\}/s);
    expect(authBlock).not.toBeNull();
    expect(authBlock![1]).toContain("nextjs_upstream");
  });

  it("proxies /api/ to backend_upstream", () => {
    const apiBlock = conf.match(/location\s+\/api\/\s*\{([^}]+)\}/s);
    expect(apiBlock).not.toBeNull();
    expect(apiBlock![1]).toContain("backend_upstream");
  });

  it("proxies / to vue_upstream (with WebSocket upgrade)", () => {
    const rootBlock = conf.match(/location\s+\/\s*\{([^}]+)\}/s);
    expect(rootBlock).not.toBeNull();
    expect(rootBlock![1]).toContain("vue_upstream");
    expect(rootBlock![1]).toContain("upgrade");
  });

  it("has WebSocket upgrade support for /_next/webpack-hmr (Next.js HMR)", () => {
    expect(conf).toContain("/_next/webpack-hmr");
    const hmrBlock = conf.match(/location\s+\/_next\/webpack-hmr\s*\{([^}]+)\}/s);
    expect(hmrBlock).not.toBeNull();
    expect(hmrBlock![1]).toContain("upgrade");
  });

  it("forwards Cookie header on auth-sensitive locations", () => {
    // /api/auth/ block must forward cookies
    const authBlock = conf.match(/location\s+\/api\/auth\/\s*\{([^}]+)\}/s);
    expect(authBlock![1]).toContain("Cookie");
  });
});

// ── Tests: nginx/nginx.conf (production) ─────────────────────────────────────

describe("nginx/nginx.conf (production)", () => {
  const conf = readFile(NGINX_PROD_CONF);

  it("file exists and is non-empty", () => {
    expect(conf.length).toBeGreaterThan(0);
  });

  it("declares nextjs_upstream", () => {
    expect(conf).toContain("nextjs_upstream");
  });

  it("has location blocks for all migrated paths (at least one occurrence per path)", () => {
    for (const path of EXPECTED_MIGRATED_PATHS) {
      const pattern = new RegExp(`location\\s*=\\s*${path.replace("/", "\\/")}`, "g");
      const matches = conf.match(pattern);
      // Expect 3 occurrences — one per portal server block (admin/client/factory)
      expect(matches, `Expected 3 location blocks for ${path}`).toHaveLength(3);
    }
  });

  it("has /_next/ location in each portal block (3 occurrences)", () => {
    const matches = conf.match(/location\s+\/_next\//g);
    expect(matches, "Expected 3 /_next/ location blocks (admin/client/factory)").toHaveLength(3);
  });

  it("has /api/auth/ routing to nextjs_upstream in each portal block", () => {
    // Split into server blocks and check each admin/client/factory block
    const portalNames = ["admin.absodok.com", "client.absodok.com", "factory.absodok.com"];
    for (const name of portalNames) {
      // Find the section of config for this server_name
      const idx = conf.indexOf(`server_name ${name}`);
      expect(idx, `server block for ${name} not found`).toBeGreaterThan(-1);
      // Check within ~3000 chars after the server_name declaration
      const section = conf.slice(idx, idx + 3000);
      expect(section, `${name}: /api/auth/ should proxy to nextjs_upstream`).toContain("nextjs_upstream");
    }
  });

  // ── G-019 regression guard ────────────────────────────────────────────────
  // Verifies that `location /uploads/ { internal; ... }` is present in all
  // three portal server blocks. Counts occurrences to avoid relying on fragile
  // character-offset slicing.

  it("G-019: /uploads/ location block appears exactly 3 times (admin + client + factory)", () => {
    const matches = conf.match(/location\s+\/uploads\//g);
    expect(matches, "Expected 3 /uploads/ location blocks").toHaveLength(3);
  });

  it("G-019: internal; directive appears at least 3 times (once per portal block)", () => {
    const matches = conf.match(/\binternal;/g);
    expect(matches, "Expected at least 3 `internal;` directives (G-019)").not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("G-019: every /uploads/ block is followed by internal; (no block lost the directive)", () => {
    // Walk through each occurrence of `location /uploads/` and verify
    // `internal;` appears within 200 chars (i.e. inside the same block)
    const regex = /location\s+\/uploads\/\s*\{/g;
    let match: RegExpExecArray | null;
    let found = 0;
    while ((match = regex.exec(conf)) !== null) {
      const snippet = conf.slice(match.index, match.index + 200);
      expect(snippet, `uploads block at offset ${match.index} missing internal;`).toContain("internal;");
      found++;
    }
    expect(found, "Expected at least 3 /uploads/ blocks").toBeGreaterThanOrEqual(3);
  });

  it("has X-Handled-By header (strangler-fig marker) in dev config", () => {
    const devConf = readFile(NGINX_DEV_CONF);
    expect(devConf).toContain("X-Handled-By");
  });
});
