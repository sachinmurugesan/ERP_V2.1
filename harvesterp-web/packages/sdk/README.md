# @harvesterp/sdk

Typed HTTP client for the HarvestERP FastAPI backend.

Built with [openapi-typescript](https://github.com/openapi-ts/openapi-typescript) (type generation) + [openapi-fetch](https://github.com/openapi-ts/openapi-typescript/tree/main/packages/openapi-fetch) (runtime). No code generation — types only.

---

## Architecture decision (D-001)

All frontend access to the backend goes through this SDK. The Next.js/React app never calls `fetch()` directly against the API.

**Tool choice:** `openapi-typescript` + `openapi-fetch`
- Types-only generation — zero runtime bloat from generated code
- Thin fetch wrapper with full request/response interception
- OpenAPI 3.1.0 compatible (FastAPI default)

**Committed generated files:** `openapi.json` and `src/generated/types.ts` are committed to git so a fresh clone works offline without running the backend.

---

## Package structure

```
packages/sdk/
├── openapi.json              # Committed OpenAPI snapshot (195 paths, 97 schemas)
├── scripts/
│   ├── fetch-spec.ts         # Fetch /openapi.json from live backend → openapi.json
│   └── generate.ts           # Run openapi-typescript on openapi.json → src/generated/types.ts
├── src/
│   ├── generated/
│   │   └── types.ts          # Auto-generated (380 KB / 13 197 lines) — do not edit
│   ├── errors.ts             # D-001 typed ApiError hierarchy
│   ├── client.ts             # createHarvestClient factory + apiClient singleton
│   ├── auth.ts               # login / logout / refreshToken / getMe helpers
│   └── index.ts              # Public barrel export
└── tests/
    ├── errors.test.ts        # 30 tests
    ├── client.test.ts        # 12 tests
    └── auth.test.ts          # 20 tests
```

---

## Quick start

### Install (workspace consumer)

```json
// apps/my-app/package.json
{
  "dependencies": {
    "@harvesterp/sdk": "workspace:*"
  }
}
```

### Basic usage

```typescript
import { createHarvestClient, login, ApiError, UnauthorizedError } from "@harvesterp/sdk";

// 1. Authenticate
const session = await login("user@example.com", "password");
localStorage.setItem("token", session.access_token);

// 2. Create a client
const client = createHarvestClient({
  baseUrl: import.meta.env.VITE_API_URL,
  getToken: () => localStorage.getItem("token"),
});

// 3. Make typed requests
const { data } = await client.GET("/api/orders/", {
  params: { query: { skip: 0, limit: 20 } },
});

// 4. Handle errors
try {
  await client.POST("/api/orders/", { body: { ... } });
} catch (err) {
  if (err instanceof UnauthorizedError) {
    // redirect to login
  }
}
```

### Default singleton

```typescript
import { apiClient } from "@harvesterp/sdk";

// Set token once (e.g. after login)
apiClient.accept(session.access_token);

// Use anywhere in the app
const { data } = await apiClient.GET("/api/auth/me");
```

---

## Auth helpers

All helpers accept an optional `config` object with `{ baseUrl?, fetch? }` for testing.

```typescript
import { login, logout, refreshToken, getMe } from "@harvesterp/sdk";

const session = await login("admin@harvesterp.com", "password");
// session: { access_token, refresh_token, token_type, user }

const fresh = await refreshToken(session.refresh_token);
// fresh: { access_token, token_type }

const me = await getMe(session.access_token);
// me: { id, email, role, user_type, roles, ... }

await logout(session.access_token);   // best-effort, never throws
```

**Storage policy:** The SDK never reads or writes `localStorage`, `sessionStorage`, or cookies. Callers own persistence.

---

## Error hierarchy

```
Error
└── ApiError              (base — statusCode, url, method, responseBody)
    ├── UnauthorizedError (401)
    ├── ForbiddenError    (403)
    ├── NotFoundError     (404)
    ├── ConflictError     (409)
    ├── ValidationError   (422 — details[]: { loc, msg, type })
    ├── RateLimitError    (429)
    └── ServerError       (5xx)
```

```typescript
import { ValidationError } from "@harvesterp/sdk";

try {
  await login("bad", "");
} catch (err) {
  if (err instanceof ValidationError) {
    const emailMsg = err.fieldError("email"); // first error for field path
    console.log(err.details); // full array
  }
}
```

---

## Client options

```typescript
const client = createHarvestClient({
  baseUrl: "http://localhost:8000",   // default: HARVEST_API_URL → NEXT_PUBLIC_API_URL → VITE_API_URL → localhost:8000
  fetch: customFetchImpl,             // SSR, testing, or custom retry logic
  getToken: () => getFromStore(),     // called per-request; takes precedence over accept()
  onBeforeRequest: async (req) => {   // mutate or replace the Request
    return new Request(req, { headers: new Headers({ ...req.headers, "X-Tenant": "acme" }) });
  },
  onAfterResponse: async (res) => {   // inspect or log the Response
    console.log(res.status);
    return res;
  },
});
```

---

## Regenerating after backend changes

```bash
# 1. Start the FastAPI backend
cd apps/backend && uvicorn main:app --reload

# 2. From the sdk package
cd packages/sdk

# Fetch latest spec and regenerate types in one command
pnpm generate

# Or step by step
pnpm fetch-spec     # writes openapi.json
pnpm run generate   # runs openapi-typescript → src/generated/types.ts

# 3. Build
pnpm build

# 4. Commit both generated files
git add openapi.json src/generated/types.ts
git commit -m "chore: regenerate SDK from updated OpenAPI spec"
```

The backend URL defaults to `http://localhost:8000`. Override with:
```bash
FASTAPI_URL=https://staging.example.com pnpm fetch-spec
```

---

## Development commands

```bash
pnpm test          # Vitest with v8 coverage (62 tests, ~95% coverage)
pnpm build         # tsup → dist/ (7.85 KB ESM + 390 KB .d.ts)
pnpm tsc --noEmit  # Type check only
```

---

## OpenAPI snapshot stats (as of last regeneration)

| Metric | Value |
|--------|-------|
| Paths | 195 |
| Schemas | 97 |
| Format | OpenAPI 3.1.0 |
| Missing operationIds | 0 |
| Multipart upload endpoints | 10 |
| Generated types file | 380 KB / 13 197 lines |
| Bundle size | 7.85 KB ESM |

---

## When to use which method

- Use `client.GET` / `POST` / `PUT` / `DELETE` for endpoints whose response schemas are fully typed in the OpenAPI spec. You get full request/response type safety.
- Use `client.getJson<T>` / `postJson<T>` / `putJson<T>` / `deleteJson<T>` for endpoints whose OpenAPI spec returns `"application/json": unknown` — typically FastAPI routes without `response_model=`. You specify the expected response type explicitly.
- Long-term plan: backend adds `response_model=` annotations to all routes, at which point all endpoints become fully typed and the `Json` variants become redundant. Until then, `Json` variants are the pragmatic escape hatch.
