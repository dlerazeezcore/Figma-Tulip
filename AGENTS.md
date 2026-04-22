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

## General Principles
- Use Tailwind generic utility classes. Do NOT create new CSS files unless absolutely necessary (all variables should go to `src/styles/theme.css`).
- Keep Modal/Sheet definitions clean, returning `null` if not `isOpen`.
- Premium mobile-first design: Solid buttons (`bg-primary`), `rounded-xl` for cards, clear hierarchy.
- For icons, always use `lucide-react`.
