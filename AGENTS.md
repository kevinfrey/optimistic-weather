# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React UI (Vite + TypeScript). Key directories include `components/ui/` for shadcn primitives, `services/` for OpenWeather requests, `types/` for shared TypeScript models, and `lib/` for utilities (e.g., history storage helpers).
- `tests/` holds Vitest suites covering fuzzy geocoding and history persistence logic. Test setup lives in `tests/setup.ts`.
- `public/` stores static assets (e.g., `vite.svg`). Build artifacts are emitted to `dist/` via Vite.

## Build, Test, and Development Commands
- `npm run dev` — launches the Vite dev server with hot module reload.
- `npm run build` — type-checks and bundles the app into `dist/` (runs `tsc -b` followed by `vite build`).
- `npm run preview` — serves production assets from `dist/` locally.
- `npm run lint` — executes ESLint with type-aware rules.
- `npm run test` — runs Vitest (unit suites under `tests/`).

## Coding Style & Naming Conventions
- TypeScript + React with strict compiler settings (`strict`, `noUnusedLocals`, etc.).
- Follow existing patterns: PascalCase for React components, camelCase for functions/variables, UPPER_SNAKE for constants.
- Styling uses Tailwind classes and shadcn/ui components; prefer utility classes over bespoke CSS.
- Linting enforced by ESLint (`typescript-eslint`, React hooks/refresh plugins). Run `npm run lint -- --fix` before committing.

## Testing Guidelines
- Vitest provides the testing environment (`jsdom`). Tests reside alongside other suites in `tests/` and should mirror feature names (e.g., `history-storage.test.ts`).
- Add coverage for new service utilities or complex UI-only logic with render tests when possible.
- Ensure `npm run test -- --run` passes before submitting PRs.

## Commit & Pull Request Guidelines
- Use short, imperative commit messages (`Add use-my-location forecast button`, `Improve dryness probability calculation`).
- PRs should describe the change, note testing (`npm run build`, `npm run test`), and include screenshots/GIFs for UI updates.
- Reference related issues and call out environment/setup changes (e.g., new env vars like `VITE_OPENWEATHER_API_KEY`).

## Security & Configuration Tips
- Never commit real API keys. Use `.env` (ignored) and update `.env.example` when configuration changes.
- When adding location-based features, handle geolocation permission failures gracefully and avoid blocking UI threads.
