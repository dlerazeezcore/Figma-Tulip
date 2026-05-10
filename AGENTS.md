# Codebase Structure and Conventions for Tulip Travel App
# Heartbeat: 2026-04-22 12:48 UTC

This is a React + TypeScript web application using Vite, React Router, and Tailwind CSS v4.
Always follow these structure constraints and conventions for this codebase.

## Directory Structure
- `src/app/pages/`: Route-level page components (e.g., `Home.tsx`, `Settings.tsx`).
- `src/app/components/`: Reusable components organized by domain:
  - `/components/ui/` - base design system components
  - `/components/flights/` - flight booking components
  - `/components/auth/` - authentication components
- `src/app/types/`: Shared TypeScript types and interfaces (e.g., `flights.ts`).
- `src/app/wiring/`: Service layer / business logic hooks.
- `src/app/routes.ts`: React Router configuration.
- `src/app/App.tsx`: Root app component.
- `src/styles/`: Theme and fonts (e.g., `theme.css`, `fonts.css`).

## Import Order Constraints
1. React and third-party libraries (`react`, `react-router`, `lucide-react`)
2. Local UI components (`../components/ui/...`)
3. Feature components (`../components/flights/...`)
4. Types (`../types/...`)
5. Services/wiring (`../wiring/...`)

## Naming and Exports
- Components: PascalCase (e.g., `FlightSearch.tsx`), match file names.
- Types: PascalCase interfaces/types, no circular imports.
- Service hooks: `use` prefix.
- Use **named function exports** for components (e.g., `export function ComponentName() {}`). Do NOT use `export default`.

## Native Build Integrity
- **Mandatory Files**: Never delete or ignore `ios/App/CapApp-SPM/Package.swift` or the sources in `ios/App/CapApp-SPM/Sources/`. These are critical for the iOS build.
- **Git Tracking**: Ensure `ios/App/CapApp-SPM` and `ios/App/App/Assets.xcassets` are ALWAYS tracked in Git (do NOT add to `.gitignore`).
- **App Icons**: Native icons for both iOS and Android must be generated from `src/imports/Tulipbooking-logo-full.svg` using `npm run generate:icons`. Do not manually edit the generated PNGs or XMLs.
- **Sync Workflow**: Always run `npm run ios:sync` or `npm run android:sync` after web changes. This ensures the bridge code and latest assets are refreshed.
- **Gradle Integrity**: Keep `android/gradle/wrapper/gradle-wrapper.jar` and `android/gradlew` intact for Android build reliability.

## App Store Connect CI Integrity
- **Mandatory Workflow File**: Never delete or rename `.github/workflows/ios-appstoreconnect.yml`. Keep this workflow intact unless explicitly asked to change iOS release automation.
- **Release Docs**: Preserve `docs/ios-appstoreconnect-github-actions.md` so operators can recover setup quickly.
- **Secrets and Keys**: Never commit `.p8`, `.p12`, private keys, or certificate raw contents to the repository.
- **GitHub Actions Configuration**: Keep these repo-level Actions values configured and do not remove them during cleanup/refactor:
  - Secrets: `APPSTORE_API_PRIVATE_KEY`, `APPSTORE_CERTIFICATES_FILE_BASE64`, `APPSTORE_CERTIFICATES_PASSWORD`, `KEYCHAIN_PASSWORD`
  - Variables: `APPSTORE_API_KEY_ID`, `APPSTORE_ISSUER_ID`
- **Migration Rule**: If CI or repo is migrated, replicate the secrets/variables above before running iOS releases.

## General Principles
- Use Tailwind generic utility classes. Do NOT create new CSS files unless absolutely necessary (all variables should go to `src/styles/theme.css`).
- Keep Modal/Sheet definitions clean, returning `null` if not `isOpen`.
- Premium mobile-first design: Solid buttons (`bg-primary`), `rounded-xl` for cards, clear hierarchy.
- For icons, always use `lucide-react`.

## AI Studio Guardrails (Required)
1. NEVER edit pnpm-lock.yaml by hand. Always run `pnpm install` after changing package.json so both files update atomically. If you only have the ability to write files (no shell), then change package.json and let CI fail loudly — don't try to surgically patch the lockfile.
2. Keep `ios/App/App/Info.plist`'s CFBundleIconName entry. Do not remove it. The app icon disappears from TestFlight without it.
3. The following files are INTENTIONALLY DELETED. Do not restore them, do not add new code that imports them, and do not add their corresponding shadcn imports:
   - src/app/components/ui/menubar.tsx
   - src/app/components/ui/breadcrumb.tsx
   - src/app/components/ui/navigation-menu.tsx
   - src/app/components/ui/context-menu.tsx
   - src/app/components/ui/resizable.tsx
   - src/app/components/ui/chart.tsx
   - src/app/components/ui/pagination.tsx
   - src/app/components/ui/carousel.tsx
   - src/app/components/ui/command.tsx
   - src/app/wiring/admin-config-service.ts
   - src/app/wiring/home-tutorial-service.ts
   - src/app/wiring/support-page-service.ts
   - src/app/pages/Support.tsx
   - src/app/components/SupportMessageBubble.tsx
   - src/app/components/SupportSkeleton.tsx
   - src/imports/Screenshot_2026-04-15_at_23.06.02.png
   - src/imports/Screenshot_2026-04-15_at_23.08.19.png
   - src/imports/Screenshot_2026-04-15_at_23.12.35.png
   - src/imports/Screenshot_2026-04-15_at_23.15.51.png
4. The following dependencies are INTENTIONALLY REMOVED. Do not add them back to package.json:
   - cmdk
   - recharts
   - react-resizable-panels
   - embla-carousel-react
   - @radix-ui/react-context-menu
   - @radix-ui/react-menubar
   - @radix-ui/react-navigation-menu
5. The following file MUST be kept and never deleted as "unused":
   - src/imports/Tulipbooking-logo-full.svg
   It looks orphan to a TS-only grep but is consumed by scripts/generate-icons.mjs (line 5: SVG_SOURCE) to generate every iOS and Android app-icon variant.
6. The Telegram support chat, the Home Tutorial Video admin panel, and the Whitelist Settings admin panel were all intentionally removed. Do not re-add admin UI sections, services, or backend client functions for any of them. The in-app support entry point is now a WhatsApp deeplink to +9647507201111 (already wired in Settings.tsx).
7. iOS version is set in `ios/App/App.xcodeproj/project.pbxproj` in TWO places (Debug and Release configs). MARKETING_VERSION and CURRENT_PROJECT_VERSION must NEVER be DECREASED. App Store Connect closes a marketing version's "train" once a build of that version is approved, and Apple permanently rejects any subsequent upload with the same or lower number.
   Concretely:
   - Treat the current values in main as the floor; only increase them.
   - If you regenerate project.pbxproj from scratch (e.g. via a Capacitor template), preserve the existing version.
   - When you intentionally bump for a new release, increment MARKETING_VERSION (e.g. 1.1.1 → 1.1.2) AND CURRENT_PROJECT_VERSION (e.g. 3 → 4) together.
8. NEVER commit binary files. AI Studio's commit pipeline corrupts non-UTF-8 bytes in transit, replacing them with the UTF-8 replacement character (0xEF 0xBF 0xBD). This silently breaks PNGs, JARs, fonts, and any other binary asset. The bug is environmental and cannot be fixed inside AI Studio.
   Forbidden file types:
     - PNG / JPG / WebP / ICO  (any image except SVG)
     - JAR / ZIP / TAR  (any archive)
     - TTF / OTF / WOFF / WOFF2  (fonts)
     - MP3 / MP4 / MOV  (media)
     - .keystore / .p12 / .jks  (signing material)
     - Any other binary file ending other than: .svg, .xml, .json, .yaml, .yml, .ts, .tsx, .js, .mjs, .cjs, .css, .html, .md, .txt, .properties, .gradle, .kts, .swift, .h, .m, .plist, .gitignore, .gitattributes
   Permitted source-of-truth replacements:
     - App icon: src/imports/Tulipbooking-logo-full.svg only. All PNG launcher icons are .gitignored and regenerated by `pnpm run generate:icons`.
     - Gradle wrapper: gradle-wrapper.jar is .gitignored; downloaded by `pnpm run fix:gradle` (called automatically by android:sync).
     - Splash screens: edit the SVG in src/imports/ if a splash needs to change; never commit the rasterized PNG.
   If you need to add a new binary file the project doesn't already handle, do NOT commit it. Instead, add a script that downloads or generates it at build time, and `.gitignore` the output path.
