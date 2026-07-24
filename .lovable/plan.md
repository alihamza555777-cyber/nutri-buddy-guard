NutriGuard is an AI-powered food inspection and nutrition tracking app. Users set dietary restrictions and macro goals in a profile, then analyze dishes by photo or text. The app returns a safety score (SAFE/CAUTION/AVOID), a nutrition breakdown, flagged allergens, and a suggested question to ask restaurant staff. Scans are saved to a history page.

## What we will build

### 1. Design system
- Friendly, organic visual direction: rounded surfaces, natural greens and warm neutrals, approachable typography.
- Update `src/styles.css` with a fresh oklch token palette and semantic Tailwind theme variables.
- Generate a hero/food image that matches the organic tone.

### 2. Backend & data (Lovable Cloud)
- Enable Lovable Cloud to get built-in auth and PostgreSQL.
- Create `profiles` table: user id, dietary flags array, target calories/protein, custom notes.
- Create `scan_history` table: scan id, user id, dish name, input type, safety level, macros/micros, flagged ingredients, explanation, waiter question, image URL.
- Add RLS policies and GRANT statements so authenticated users can read/write their own rows.
- Set up Supabase Auth integration files (client, middleware, auth helpers) following the TanStack Start pattern.

### 3. App structure
- `src/routes/index.tsx` — Dashboard/home with scanner input, results, and navigation.
- `src/routes/profile.tsx` — Dietary profile settings form.
- `src/routes/history.tsx` — Filterable scan history table.
- `src/routes/_authenticated.tsx` — Layout gate so profile and history require login; public home lets visitors try scanning.
- `src/routes/auth.tsx` — Sign-up / sign-in page.
- `src/routes/sitemap.xml.ts` + `public/robots.txt`.

### 4. AI food analysis
- Implement a `createServerFn` in `src/lib/scan.functions.ts` that calls Lovable AI Gateway.
- Prompt returns structured JSON: safety_level, nutrition, flagged_ingredients, explanation, waiter_question.
- Support both text dish names and base64 image inputs.
- Save successful scans to `scan_history`.

### 5. UI components
- Scanner card with tabs for photo upload and text input.
- Safety scorecard badge with green/yellow/red states.
- Nutrition breakdown grid with progress bars against daily goals.
- Allergen alert box and "Ask Your Server" card.
- Profile form with restriction checkboxes, macro targets, custom notes.
- History table with safety badge and date filtering.

### 6. Head metadata
- Unique titles, descriptions, og tags for each public route.

## Out of scope for this first version
- Real-time sync, barcode scanning, third-party nutrition APIs, meal planning beyond single-dish analysis, push notifications.

## Technical notes
- Built on TanStack Start (the current stack), not Next.js, so routing/server functions follow TanStack conventions.
- AI calls use Lovable AI Gateway via the AI SDK, kept server-side.
- Auth uses Lovable Cloud / Supabase Auth with the `_authenticated` layout gate.