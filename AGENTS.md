# Monsters & Memories Cartographer AI Guide

This repository is a mixed Vue 3 + Express + PostgreSQL application with a large amount of feature logic living in a few central files. Use the existing patterns here instead of introducing a cleaner-but-incompatible architecture in one pass.

## High-value orientation

- The main interactive map app lives in [src/App.vue](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/App.vue). It is large and acts as the orchestration layer for canvas rendering, routing, auth-aware UI, filters, dialogs, map data loading, and most user actions.
- The backend entry point is [server.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/server.js). Core map, POI, auth, profile, admin, custom POI, and pending POI routes are defined directly there.
- Specialized backend modules live under [src/api](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/api), but the project is not consistently router-driven. Most modules export `function(app, validateCSRF)` and register routes directly on the app. `donation-tiers.js` is the main exception and uses `express.Router()`.
- The live account UI is served from [public/account.html](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/public/account.html), not from the Vue view layer.
- [src/views/AccountPage.vue](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/views/AccountPage.vue) appears stale and includes debug text plus a missing `TestComponent` import target. Do not treat it as the source of truth unless you are explicitly re-wiring the account page into Vue.

## Frontend implementation patterns

- The frontend uses Vue 3, but the established style is classic SFCs with `export default { setup() {} }`, not `<script setup>` and not TypeScript.
- State is mostly managed with `ref`, `computed`, and `watch`. Shared state is lightweight and lives in composables like [src/composables/useAuth.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/composables/useAuth.js), [src/composables/useCSRF.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/composables/useCSRF.js), and [src/composables/useToast.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/composables/useToast.js).
- `src/App.vue` imports service helpers from [src/services/api.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/services/api.js) for maps, POIs, and connectors, but many other reads and writes still use direct `fetch`. Do not assume the repo has one unified frontend API layer.
- Mutating requests should go through `fetchWithCSRF` or an existing helper that already wraps it. GET requests usually use direct `fetch`.
- Components communicate through explicit props/emits. When adding UI, prefer matching the current component contract style over introducing provide/inject or a global store.
- Scoped styles are the default for components. Global layout and app-wide theme rules live in [src/style.css](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/style.css).
- The map itself is canvas-rendered. Rendering, hit testing, grouping, and hover behavior are sensitive to scale math and image coordinates. Reuse existing helpers from [src/composables/useMapViewer.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/composables/useMapViewer.js), [src/composables/useMapInteractions.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/composables/useMapInteractions.js), and [src/utils/entityId.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/utils/entityId.js) instead of inventing parallel coordinate or ID logic.

## UI and design conventions

- The core app uses a dark fantasy aesthetic:
  - Charcoal and near-black backgrounds.
  - Gold/orange highlight colors such as `#FFD700`, `#FFA500`, `#FF8C00`.
  - Occasional muted green for positive/admin actions.
  - The `Cinzel` font is used for major title branding.
- Most overlays are dark, slightly translucent cards with light borders, strong shadows, and rounded corners.
- Buttons typically follow this visual language:
  - Positive/confirm: muted green.
  - Secondary/cancel: dark gray.
  - Destructive: red accents.
- The UI uses emoji heavily as a first-class visual system. Do not replace emoji-driven affordances with generic icon libraries unless the relevant feature already supports alternate icon types.
- Many components render icons dynamically via `icon_type` and `icon_value`. Existing supported patterns include `emoji`, `iconify`, `fontawesome`, and `upload`.
- Preserve the current visual language on map-facing UI. Avoid introducing bright white cards, modern SaaS styling, or a second design system inside the main app.
- The account experience has its own large inline HTML/CSS/JS implementation in `public/account.html`; if you touch it, keep its existing dark styling and imperative DOM approach unless the task is a deliberate migration.

## Backend patterns

- The backend is ESM Node/Express, with PostgreSQL accessed through `pg`.
- SQL is written inline with parameterized queries. Match that style.
- For multi-step writes, use explicit transactions with `BEGIN` / `COMMIT` / `ROLLBACK`.
- Always perform permission checks on the server. Frontend admin mode is only a UI state; real enforcement happens in backend route handlers.
- CSRF is required for most mutating routes. Preserve `validateCSRF` on new write endpoints unless there is a clear reason not to.
- Caching exists for map data and some user stats via [src/utils/cache.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/utils/cache.js). If you add or change mutating behavior around cached resources, check whether caches need invalidation.
- Authentication is session-based with Passport Google OAuth. Read [src/auth/passport-config.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/auth/passport-config.js) and the auth endpoints in [server.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/server.js) before changing login or user profile flows.

## Data model realities

- Do not assume [src/db/schema.sql](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/db/schema.sql) is the full current schema. It bootstraps core tables, but later features were added through many `create-*` and `add-*` SQL files under [src/db](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/db).
- Core map data:
  - `maps`
  - `pois`
  - `point_connectors`
  - `zone_connectors`
- Community/user-authored data:
  - `custom_pois`
  - `custom_poi_shares`
  - `pending_pois`
  - `change_proposals`
  - `change_proposal_votes`
- Classification and content:
  - `poi_types`
  - `poi_type_icons`
  - `items`
  - `npcs`
  - `npc_loot`
  - `poi_npc_associations`
  - `custom_poi_npc_associations`
- User/meta systems:
  - `users`
  - `user_preferences`
  - donation tier tables
  - XP config/history tables
  - warning/ban/admin-supporting tables added through later migrations

## Data model gotchas

- `npcs.id` and `npcs.npcid` are both used. `npcid` is often the public/game-facing identifier and is what many POI relationships use. Verify which one an endpoint expects before wiring new queries or frontend payloads.
- Official POIs, custom POIs, pending POIs, and proposals are related but not interchangeable. Keep their route contracts and status fields straight.
- `change_proposals` uses flexible JSONB payloads. New proposal types should fit the existing pattern rather than creating one-off tables unless there is a strong reason.
- POI type metadata is central to rendering. `type_id`, `icon_type`, `icon_value`, and `multi_mob` affect both UI and behavior.
- Entity IDs are not fully uniform. Custom POIs can appear as legacy strings like `custom_63`, while other entities are numeric. Use helpers like `isSameEntity` and related utilities in `src/utils/entityId.js` when comparing or normalizing IDs.

## Active integration points

- Main Vue routes are defined in [src/main.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/main.js) and are map/search focused.
- `/account` is served separately from Express and resolves to `dist/account.html` or `public/account.html`.
- Search is backed by [src/api/search.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/api/search.js) and returns mixed result types for POIs, custom POIs, items, and NPCs.
- Proposal and voting behavior spans the map UI, `public/account.html`, and [src/api/change-proposals.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/api/change-proposals.js). Changes here often need updates in more than one place.

## Working rules for AI changes

- Before editing, identify whether the requested feature belongs in:
  - `src/App.vue` and Vue components,
  - `server.js`,
  - a specialized router in `src/api`,
  - `public/account.html`,
  - or a migration in `src/db`.
- Do not migrate a feature to a new paradigm unless the task explicitly asks for that migration.
- Prefer extending the existing monolithic orchestration points over splitting one small part into a new architecture that the rest of the repo does not follow.
- Keep route payload shapes backward compatible when possible. Several frontend surfaces depend on legacy fields.
- When touching database behavior, inspect both the route query and the relevant migration/create-table SQL. Schema drift is real in this codebase.
- When touching POI or connector interactions, verify behavior for:
  - official POIs,
  - custom POIs,
  - grouped POIs at low zoom,
  - admin mode,
  - proposal-preview state.
- When touching account/admin features, verify whether the live behavior is in `public/account.html` before editing Vue code.

## Verification

- There is no mature automated test suite. The only visible test-like file is [src/utils/entityId.test.js](/Users/robg/Documents/GitHub/Monsters-and-Memories-Cartographer/src/utils/entityId.test.js), which is a console script rather than a real test runner.
- Minimum verification for most changes:
  - `npm run build`
  - exercise the affected route or UI flow manually
  - for backend/data changes, confirm expected JSON shapes and permission behavior
- If you add schema-dependent features, include the migration and state clearly which tables/columns the change expects.

## Useful commands

- Dev client: `npm run dev`
- Dev server: `npm run dev:server`
- Full local run: `npm run dev:full`
- Production build: `npm run build`
- DB migration entry point: `npm run migrate`

## Short version

- Main map work: start in `src/App.vue`.
- Account/admin page work: check `public/account.html` first.
- Backend work: many important routes are still in `server.js`.
- Styling: keep the dark fantasy / gold-accent visual language.
- Data work: trust migrations and create-table files more than `schema.sql`.
- ID handling and POI/NPC relations have legacy edges; reuse existing helpers and patterns.
