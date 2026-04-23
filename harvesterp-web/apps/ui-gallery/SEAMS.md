# SEAMS.md — Architectural Seams for `@harvesterp/ui-gallery`

> A **seam** is a place in the code where you can alter behaviour without editing the code.  
> — Michael Feathers, *Working Effectively with Legacy Code*

This document records every deliberate architectural seam in the Layer 2 gallery, explains why it exists, and describes the Task 7 wiring needed when porting to the Next.js App Router.

---

## §1 — `"use client"` Directive

### What & Where
Every interactive component in `src/components/` carries `"use client"` at the top:

| File | Reason |
|------|--------|
| `design-system/icon.tsx`        | SVG renderable in RSC, but directive future-proofs (no overhead in Vite) |
| `design-system/ds-avatar.tsx`   | Calls lib functions; stays client-safe |
| `design-system/spark-line.tsx`  | SVG state (random gradient ID) |
| `design-system/area-chart.tsx`  | SVG rendering |
| `design-system/bar-chart.tsx`   | SVG rendering |
| `design-system/donut.tsx`       | SVG rendering |
| `design-system/progress.tsx`    | Purely presentational; directive for consistency |
| `design-system/logo.tsx`        | SVG; directive for consistency |
| `shells/sidebar.tsx`            | `useState` (active tracking), `onClick` handlers |
| `shells/topbar.tsx`             | `useState` (hover), `onClick` handlers |
| `composed/kpi-card.tsx`         | Composes interactive components |

### Why in Vite
Vite (Layer 2 gallery) **ignores** the directive — it processes all files as client-side JS.  
The directive is a **no-op here but required for Next.js App Router**.

### Task 7 Action
When importing these components from Next.js Server Components, the directives are already present — no changes required. Components that do NOT need client interactivity can remove the directive after audit.

---

## §2 — Router Abstraction (`onNavigate` callback)

### What & Where
`Sidebar` and any future components that would navigate do **not** import `react-router-dom` or `next/navigation` directly. Instead, they expose:

```typescript
onNavigate?: (id: string) => void;
```

### Current Wiring (Vite gallery)
`SidebarGallery.tsx` wires `onNavigate` to `React.useState`:

```typescript
const [active, setActive] = React.useState("dashboard");
<Sidebar active={active} onNavigate={setActive} />
```

Screen ports (e.g., `DashboardV1Screen.tsx`) wire it similarly with local state.

### Task 7 Wiring (Next.js App Router)
```typescript
// In a Next.js Server or Client Component:
"use client";
import { useRouter } from "next/navigation";

const router = useRouter();
<Sidebar onNavigate={(id) => router.push(`/app/${id}`)} />
```

The Sidebar component requires **zero changes**. Only the consumer's wiring changes.

### Why This Matters
- Avoids bundling `react-router-dom` into the Next.js app
- Allows server-side rendering of the Sidebar shell itself
- Enables Next.js prefetching by using `<Link>` in the consumer instead of `onClick`

---

## §3 — Theme Toggle Callback (`onToggleTheme`)

### What & Where
`Topbar` does **not** manipulate `document.documentElement.classList` directly.  
Instead it calls:

```typescript
onToggleTheme?: () => void;
```

The consumer is responsible for the DOM mutation.

### Current Wiring (Vite gallery)
Screen ports wire it directly:

```typescript
const toggleTheme = () => {
  const next = theme === "light" ? "dark" : "light";
  setTheme(next);
  document.documentElement.classList.toggle("theme-dark", next === "dark");
};
<Topbar theme={theme} onToggleTheme={toggleTheme} />
```

### Task 7 Wiring (Next.js)
In Next.js, `document` access must be inside a `useEffect` or event handler.  
A `ThemeProvider` component (e.g., from `next-themes`) would own the toggle:

```typescript
"use client";
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
<Topbar
  theme={(theme as "light" | "dark") ?? "light"}
  onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
/>
```

The Topbar component requires **zero changes**.

---

## §4 — Currency State (`onCurrencyChange`)

### What & Where
`Topbar` accepts `currency` and `onCurrencyChange` as controlled props.  
It does not own currency state.

### Current Wiring (Vite gallery)
```typescript
const [currency, setCurrency] = React.useState<Currency>("INR");
<Topbar currency={currency} onCurrencyChange={setCurrency} />
```

### Task 7 Wiring (Next.js)
Currency preference should live in a global context or URL search param:

```typescript
// URL approach: ?currency=USD
const searchParams = useSearchParams();
const router = useRouter();
const currency = (searchParams.get("currency") as Currency) ?? "INR";
<Topbar
  currency={currency}
  onCurrencyChange={(c) => router.replace(`?currency=${c}`)}
/>
```

This enables deep-linkable, SSR-compatible currency display.

---

## §5 — Tailwind v3 → v4 Migration

### Current State
`tailwind.config.ts` uses **Tailwind v3** with the `hsl(var(--primary))` CSS variable pattern required by shadcn/ui components.

### Why v4 Was Deferred
Tailwind v4 uses a **CSS-first `@theme` block** rather than a `tailwind.config.ts`:

```css
/* v4 approach */
@import "tailwindcss";
@theme {
  --color-brand-500: #10B981;
}
```

shadcn/ui's current components use the v3 pattern (`hsl(var(--primary))`) which assumes Tailwind processes the HSL value. In v4, this requires the `@theme inline` variant and a full shadcn component rewrite.

### Task 7 Migration Steps
1. Upgrade: `pnpm add tailwindcss@latest`
2. Replace `tailwind.config.ts` with `@import "tailwindcss"` + `@theme {}` block in `globals.css`
3. Update all shadcn components from `hsl(var(--primary))` to direct `var(--primary)` (v4 format)
4. Remove `postcss.config.js` Tailwind plugin
5. Test all gallery pages for visual regressions

### Preserved seam
All `.btn`, `.chip`, `.card`, `.input`, `.tbl`, `.nav-item`, `.kpi-*` classes in `globals.css` are **plain CSS** in `@layer components` — they are NOT generated by Tailwind utilities and work identically in v3 and v4.

---

## §6 — `@harvesterp/lib` CSS Bundle (Task 7)

### Current State
Design tokens are **inlined** in `globals.css`:

```css
/* TODO Task 7: replace with @import "@harvesterp/lib/dist/tokens.css" */
:root {
  --brand-500: #10B981;
  /* ... 60+ vars */
}
```

### Task 7 Action
Once `@harvesterp/lib` exposes a CSS bundle (`dist/tokens.css`), replace the inline block:

```css
@import "@harvesterp/lib/dist/tokens.css";
/* Remove the :root { --brand-* ... } block above */
```

The lib package's `cssVariables` and `cssVariablesDark` TypeScript exports are the source of truth; the CSS bundle will be generated from them.

---

## §7 — Screen Ports as Full-Bleed Routes

### What & Where
Screen ports (`DashboardV1Screen`, `FinanceScreen`, etc.) are routed **outside** the `GalleryLayout` chrome:

```typescript
// App.tsx — outside /gallery nested route
<Route path="/gallery/screen/dashboard-v1" element={<DashboardV1Screen />} />
```

This gives them full `100vh` height for the Sidebar + Topbar layout demonstration.

### Why
The gallery's own sidebar chrome would conflict with the ERP sidebar inside the screen port.

### Task 7 Action
Screen port components map 1:1 to Next.js app pages:

```
/gallery/screen/dashboard-v1 → /app/dashboard/page.tsx
/gallery/screen/finance       → /app/finance/page.tsx
```

The component code moves unchanged; only the file system routing changes.

---

## Summary Table

| Seam | Location | Vite gallery wiring | Task 7 wiring |
|------|----------|---------------------|---------------|
| `"use client"` | All interactive components | No-op (Vite ignores) | Required for Next.js RSC boundary |
| `onNavigate` | `Sidebar` | `useState` | `useRouter().push()` |
| `onToggleTheme` | `Topbar` | `classList.toggle` | `next-themes` setTheme |
| `onCurrencyChange` | `Topbar` | `useState` | `useSearchParams` / context |
| Tailwind version | `tailwind.config.ts` | v3 (HSL CSS vars) | v4 CSS-first `@theme` |
| Token CSS bundle | `globals.css` | Inlined `:root` vars | `@import "@harvesterp/lib/dist/tokens.css"` |
| Screen routes | `App.tsx` | Outside `GalleryLayout` | Next.js `app/` pages |
