# Design System Specification: High-End Editorial ERP

## 1. Overview & Creative North Star
### The Creative North Star: "The Precision Architect"
This design system rejects the cluttered, "spreadsheet-heavy" legacy of supply chain management. Instead, it adopts the persona of a **Digital Architect**: clean, structural, and authoritative. We move beyond standard B2B templates by utilizing **intentional asymmetry** and **tonal depth** to guide the eye.

The experience is defined by high-contrast typography scales and "breathing" data density. We do not use borders to separate ideas; we use space and light. The goal is a platform that feels as premium as a high-end editorial magazine, yet functions with the lethal efficiency of a command line interface.

---

## 2. Colors: Tonal Layering & The "No-Line" Rule
Our palette is rooted in a sophisticated interaction between **Emerald (#10B981)** for action and **Indigo (#6366F1)** for brand depth, set against a meticulously tiered grayscale.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders for sectioning are strictly prohibited. 
Structural boundaries must be defined solely through:
1.  **Background Color Shifts:** A `surface-container-low` section sitting on a `surface` background.
2.  **Negative Space:** Using the 8px/12px spacing scale to create distinct visual groups.
3.  **Soft Tonal Transitions:** Subtle shifts in hue to denote change in context.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, physical layers. Each level of "importance" or "nesting" requires a shift in the surface token:
*   **Base Layer:** `surface` (#f6fafe) – The infinite canvas.
*   **Secondary Content:** `surface-container-low` (#f0f4f8) – For sidebars or utility panels.
*   **Primary Cards:** `surface-container-lowest` (#ffffff) – For the highest focal point of data.
*   **Interactive Elements:** `surface-container-high` (#e4e9ed) – For hovered states or nested sub-sections.

### The "Glass & Gradient" Rule
To elevate the "Vercel-inspired" aesthetic, floating elements (modals, dropdowns) must use **Glassmorphism**. 
*   **Value:** `surface` color at 80% opacity with a `20px` backdrop-blur.
*   **Signature Textures:** Main CTAs should use a subtle linear gradient from `primary` (#006c49) to `primary_container` (#10b981) at a 135-degree angle. This adds a "jewel-toned" depth that flat hex codes cannot replicate.

---

## 3. Typography: The Editorial Data Lens
We use a dual-font strategy to balance human readability with technical precision.

*   **Inter (Humanist/Heading):** Used for all UI labels, headings, and body text. It conveys trust and modernism.
*   **JetBrains Mono (Technical/Data):** Used exclusively for "hard" data—order numbers, tracking IDs, currency, and timestamps. This font choice signals to the user that they are looking at raw, accurate system output.

### The Typography Scale
*   **Display-LG (3.5rem):** High-impact metrics. Tracking: -0.02em.
*   **Headline-SM (1.5rem):** Page titles. Semi-bold.
*   **Title-SM (1rem):** Card titles. Medium weight.
*   **Body-MD (0.875rem):** Standard UI text.
*   **Label-SM (0.6875rem):** JetBrains Mono. All caps for metadata.

---

## 4. Elevation & Depth: Tonal Sophistication
Hierarchy is achieved through **Tonal Layering** rather than shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f0f4f8) section. This creates a soft, natural "lift" without visual noise.
*   **Ambient Shadows:** Use only for floating elements (Modals, Popovers).
    *   `box-shadow: 0 20px 40px rgba(23, 28, 31, 0.06);` 
    *   Shadows must be extra-diffused and tinted with the `on-surface` color, never pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **20% opacity**. Never use 100% opaque borders.

---

## 5. Components: Primitive Guidelines

### Buttons
*   **Primary:** Gradient (`primary` to `primary_container`), `8px` radius, white text. No border.
*   **Secondary:** `surface-container-high` background. No border. 
*   **Tertiary:** Transparent background, `primary` text. Use for low-priority actions.

### Cards & Lists
*   **Forbid Dividers:** Do not use 1px lines between list items. Use 12px of vertical padding and a 4px `surface-container-low` gap to separate list items.
*   **Radius:** Cards use `lg` (1rem), inner elements use `DEFAULT` (0.5rem).

### Input Fields
*   **Style:** `surface-container-lowest` background with a subtle `1px` Ghost Border (20% opacity).
*   **Focus:** A 2px ring of `secondary` (#4648d4) with a 4px offset.

### Signature Component: The "Data Pulse"
A custom component for supply chain status. A `JetBrains Mono` label paired with a small, glowing orb using the `primary_fixed` color with a soft CSS pulse animation to indicate "Live" data streams.

---

## 6. Do’s and Don’ts

### Do
*   **Use Mono for Numbers:** Always use `JetBrains Mono` for SKU numbers and prices to ensure tabular alignment.
*   **Embrace Whitespace:** If a layout feels crowded, increase spacing using the `8` (1.75rem) or `10` (2.25rem) tokens. 
*   **Nesting:** Always place lighter surfaces on darker backgrounds to imply "elevation."

### Don’t
*   **No "Boxy" Grids:** Avoid surrounding every element in a box. Let the typography and color shifts define the zones.
*   **No Pure Grey Shadows:** Shadows must always be soft and tinted to match the ambient environment.
*   **No Default Inter for Data:** Never use `Inter` for long strings of numbers; it lacks the rhythmic clarity of `JetBrains Mono`.

### Accessibility Note
Ensure that all `on-surface` text maintains at least a 4.5:1 contrast ratio against its respective `surface` tier. Use the `outline` token (#6c7a71) for non-text elements requiring visibility.