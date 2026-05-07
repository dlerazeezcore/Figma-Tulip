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
