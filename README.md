# Tulip Mobile App

**Tulip is a mobile-only eSIM management application.** This app is exclusively designed for mobile devices and is not intended to be responsive across desktop or tablet views. All UI, interactions, and design patterns are optimized specifically for smartphone screens (375-430px width).

Figma-first mobile eSIM app built with React, Vite, Tailwind, and Capacitor.

Primary Figma Make file:
- [Tulip Mobile App](https://www.figma.com/make/53FmQC5cOzbjjsbo1v31CV/Tulip-Mobile-App)

Backend reference:
- [backendformobileapp README](https://github.com/dlerazeezcore/backendformobileapp/blob/main/README.md)

## Product Principles

- Figma is the source of truth for UI structure and visual changes.
- Local code owns wiring, API integration, state normalization, and platform behavior.
- The app must keep working in all supported environments:
  - Figma preview
  - local web
  - iOS
  - Android
- UI screens stay thin so future Figma updates do not force logic rewrites.
- Native-only behavior must degrade safely on Figma and local web.
- **Mobile-only focus:** All designs and components target smartphone screens exclusively.

## Architecture

The project is intentionally split so design code and behavior code do not drift together.

- `src/app/pages`
  Thin screen composition only. Pages should render wiring models, not own API orchestration.
- `src/app/components`
  Reusable presentational building blocks and route shells.
- `src/app/utils`
  Narrow helpers for formatting, lightweight platform helpers, and view utilities.
- `src/app/wiring`
  All business logic, backend integration, request orchestration, session handling, normalization, and page-model hooks.

Current domain seams inside `src/app/wiring`:
- `account-service.ts`
  Authentication and account-facing wiring exports.
- `catalog-service.ts`
  Destinations, plans, and currency reads.
- `orders-service.ts`
  Purchase, eSIM, activation, and top-up flows.
- `*-page-service.ts`
  Screen-specific view models and orchestration.
- `http.ts`
  Shared API transport with auth headers, strict base resolution, and FormData support.
- `query-cache.ts`
  Lightweight in-memory dedupe/cache for stable read endpoints.

## Thin-UI Contract

Keep this contract intact:

- Pages do not fetch directly with `fetch`.
- Pages do not talk to storage directly unless a UI-only concern truly requires it.
- Pages do not contain backend mapping or normalization logic.
- Reusable UI components should stay presentational whenever possible.
- Business rules belong in `src/app/wiring`.

Automated guard:
- `npm run check:thin-pages`
  Blocks page-level wiring leaks such as direct API calls, storage orchestration, and non-page-service wiring imports from `src/app/pages`.

If a change is mostly about behavior, pricing rules, session flow, API shape, classification, or platform branching, it belongs in wiring.

## Cross-Platform Rules

- Figma must render without unresolved native module imports.
- Local web must keep working with `npm run dev` and `npm run build`.
- iOS and Android must keep working after `npx cap sync`.
- Native features must be runtime-gated instead of crashing on non-native targets.

## Figma Workflow

1. Design or update UI in Figma first.
2. Sync or apply the design locally.
3. Keep local screens/components visually aligned with Figma.
4. Implement behavior in `src/app/wiring`.
5. Verify local web first.
6. Sync native platforms and verify iOS/Android when the change affects runtime behavior.

If a change is purely UI/UX, prefer preparing the Figma prompt first and keep the code change minimal.

## Repository Hygiene

- Do not move app code to the repo root.
- Remove dead wrappers, empty folders, and generated UI that is no longer imported.
- Avoid duplicate logic layers when a focused wiring export already exists.
- Keep generated or machine-local files out of the repo surface.

The repo now ignores common local noise such as:
- `.DS_Store`
- `.idea/`
- `node_modules/`
- `build/`
- native local build outputs

## Local Development

Install dependencies:

```bash
npm i
```

Start the local web app:

```bash
npm run dev
```

Run a production build check:

```bash
npm run build
```

Run thin-page architecture check directly:

```bash
npm run check:thin-pages
```

## Native Workflows

Sync Android with the latest web build:

```bash
npm run android:sync
```

Open Android Studio:

```bash
npm run android:open
```

Run Android directly:

```bash
npm run android:run
```

Sync iOS with the latest web build:

```bash
npm run ios:sync
```

Open Xcode:

```bash
npm run ios:open
```

Run iOS directly:

```bash
npm run ios:run
```

## Android Release

Build, sync, bump Android `versionCode`, and generate a signed bundle:

```bash
npm run android:release
```

Optional version name override:

```bash
npm run android:release --versionname=1.0.1
```

Release artifact:
- `android/app/build/outputs/bundle/release/app-release.aab`

## Backend Expectations

This frontend now integrates only with `backendformobileapp` under `/api/v1/*`.

Hard rule:
- no old backend URL fallbacks
- no `/api/esim-app/*` compatibility path
- if an endpoint is not implemented in `backendformobileapp`, frontend must fail gracefully and stay ready for progressive wiring
- localStorage API-base overrides are disabled by default (enable only with `VITE_ALLOW_LOCAL_API_BASE_OVERRIDE=true`)

Currently wired backend domains:
- `/api/v1/auth/*` (user login, auth me)
- `/api/v1/admin/users`
- `/api/v1/admin/admin-users`
- `/api/v1/admin/featured-locations`
- `/api/v1/admin/profiles`
- `/api/v1/admin/profiles/install`
- `/api/v1/admin/profiles/activate`
- `/api/v1/esim-access/locations/query`
- `/api/v1/esim-access/packages/query`

Currently not available in backendformobileapp (frontend intentionally gated):
- support chat routes
- push device sync/admin push routes
- legacy currency/whitelist settings routes
- home tutorial upload/settings routes
- FIB gateway create/verify routes (frontend is ready and will call backend when these are added)
- old purchase endpoints (`/purchase/*`)

When an unavailable feature is triggered, wiring should return a clear message like:
- `"... is not available in backendformobileapp yet."`

## Checkout Payment Wiring (Current)

Checkout now uses managed order persistence for long-term consistency:

- `Loyalty` purchase:
  - frontend verifies loyalty access from `/api/v1/auth/me`
  - frontend books through `POST /api/v1/esim-access/orders/managed`
  - frontend triggers `POST /api/v1/esim-access/profiles/sync` after booking
- `FIB` purchase:
  - frontend creates a pending checkout draft in session storage (`pendingOrderData`)
  - frontend attempts FIB create endpoints:
    - `/api/v1/payments/fib/checkout`
    - `/api/v1/payments/fib/create`
    - `/api/v1/payments/fib/intent`
    - `/api/v1/payments/fib/initiate`
  - after payment app-return (`/checkout?payment=success`), frontend finalizes booking through `orders/managed` and syncs profiles

Design rule:
- this flow is wiring-only and does not require page-level UI rewrites
- future payment methods should reuse the same pattern:
  1. create provider-specific payment intent
  2. keep pending checkout draft
  3. finalize booking with `orders/managed`

## My eSIMs Performance Model

`My eSIMs` now follows a two-phase load:

1. Fast paint:
   - load list with cached lifecycle hints for immediate render
2. Background verification:
   - fetch authoritative lifecycle/order status and refresh cards

Additional protections:
- refresh calls are throttled to avoid repeated heavy lookups during focus/visibility churn
- concurrent refresh requests are deduped in wiring
- page remains thin; all orchestration stays in `src/app/wiring/my-esims-page-service.ts`

## Figma Ownership Rule

Figma is allowed to overwrite only:
- `guidelines/`
- `src/`
- `ATTRIBUTIONS.md`
- `README.md`
- `index.html`
- `package.json`
- `postcss.config.mjs`
- `vite.config.ts`

All other files are repo-managed and should not be treated as disposable Figma output.
