# Optimistic Weather

Optimistic Weather is a Vite + React + TypeScript single-page app that reframes OpenWeather forecasts into upbeat, glass-half-full highlights. It pairs a bright UI powered by Tailwind CSS and shadcn/ui with a rules engine that celebrates every silver lining—dry spells, blue-sky windows, friendly breezes, humidity perks, and more.

## Features
- **Optimistic forecasting** – Converts OpenWeather 5-day/3-hour forecasts into positive takeaways for the next 24 hours.
- **Segmented unit toggle** – Instant Fahrenheit/Celsius switch with optimistic copy preserved across units.
- **shadcn/ui styling** – Tailwind CSS design tokens and components deliver a polished, glassmorphism-inspired layout.
- **Resilient UX** – Friendly error states when locations fail lookup, quick-pick suggestions, and loading feedback.
- **Smart search history** – Recent lookups persist locally so you can replay bright-side forecasts in a single click, including errored attempts for quick retries.
- **Zip code friendly** – Recognises common postal-code formats (e.g. `94103` or `W1A,GB`) and maps them to the right place automatically.

## Requirements
- Node.js 20+
- An OpenWeather API key (free tier works). Enable the Geocoding API and 5 day / 3 hour Forecast API.

## Getting Started
1. Clone the repository and install dependencies:
   ```sh
   npm install
   ```
2. Copy the environment file and add your API key:
   ```sh
   cp .env.example .env
   # edit .env and paste your OpenWeather key
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
   Vite prints a local URL—open it in your browser to explore the optimistic outlooks. Your recent searches are saved locally, so returning visitors can replay them instantly.

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite’s development server with hot module reloading. |
| `npm run build` | Type-check and produce a production build under `dist/`. |
| `npm run preview` | Serve the built assets locally for a production sanity check. |
| `npm run lint` | Run ESLint with type-aware rules using your local TypeScript project. |

## Linting & Code Quality
- ESLint is configured with `typescript-eslint`’s type-aware presets plus stylistic rules. The project is linted against the actual TypeScript program, so editor diagnostics match CI.
- React fast-refresh rules, Tailwind-aware tokens, and strict TypeScript practices (`consistent-type-imports`, `no-floating-promises`) are enforced.
- Fix most issues automatically with `npm run lint -- --fix`.

## UI Stack
- **Tailwind CSS** with custom design tokens in `src/index.css`.
- **shadcn/ui** button, input, card, and toggle-group primitives for consistent components.
- **Lucide Icons** available for future optimistic iconography.

## API Notes
- Forecast requests call `fetchOptimisticForecast` in `src/services/openWeather.ts`, which performs geocoding then constructs highlights from the first ~24 hours of data.
- The app surfaces error details when the API returns 4xx/5xx responses, so you can see authentication or location issues instantly.
- To avoid rate limits in production, consider caching responses or throttling repeated lookups.

## Deployment
1. Build with `npm run build`.
2. Deploy the `dist/` folder to your hosting provider of choice (Netlify, Vercel, AWS S3 + CloudFront, etc.).
3. Set `VITE_OPENWEATHER_API_KEY` in your deployment environment—Vite exposes variables prefixed with `VITE_` at runtime.

Enjoy spreading sunshine, even when the forecast looks cloudy!
