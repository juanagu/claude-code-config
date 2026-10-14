# Development

`npm ci`, then `npm run dev` on :3000. The app talks to the bff through the `/api/*` rewrite; set `BFF_INTERNAL_URL` in `.env.local`.

## Tests

- `npm test`: vitest unit tests under `tests/unit/`.
- `npm run test:e2e`: Playwright, projects `chromium` and `mobile-chromium`, against a production build.
