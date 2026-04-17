# Rouda — Setup

Voice-first kiosk chatbot for the FPT Taroudant orientation event (April 2026).
Built by Zyllux Digital.

This file is for **developers**. For production deployment on the physical kiosk, see `KIOSK.md`.

---

## Prerequisites

- Node.js ≥ 20.11 (LTS)
- pnpm ≥ 9 (`npm i -g pnpm` if needed)
- A modern Chromium-based browser for development. Production runs Chrome 120+ in kiosk mode.

## Install

```bash
pnpm install
```

## Environment

Create `.env.local` at the repo root:

```env
# n8n chat webhook — server-only, never exposed to the browser.
# Do NOT prefix with NEXT_PUBLIC_.
N8N_WEBHOOK_URL=https://<your-n8n-host>/webhook/<chat-endpoint>

# Optional: force MSW mock mode in development (default: false)
NEXT_PUBLIC_USE_MOCKS=false

# Optional: relax kiosk hardening (zoom, context menu, etc.) for dev inspection
NEXT_PUBLIC_DISABLE_KIOSK_GUARDS=false
```

Production env on Vercel: set `N8N_WEBHOOK_URL` only, scope = Production.

## Scripts

```bash
pnpm dev          # Next.js dev server on http://localhost:3000
pnpm dev:mock     # Same, with NEXT_PUBLIC_USE_MOCKS=true (offline, MSW-served fake n8n)
pnpm build        # Production build
pnpm start        # Run the production build locally
pnpm test         # Vitest unit tests
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
```

## Pointing at live n8n vs mock

- `pnpm dev` proxies the real `N8N_WEBHOOK_URL` through `/api/chat`.
- `pnpm dev:mock` intercepts `/api/chat` with MSW and returns a 3s pre-recorded sine MP3
  (one French, one Arabic, alternating). No network needed — useful for working on
  character + UI in transit / offline.

The MSW handler also simulates the realistic 1.5–3.5s latency of the live endpoint
so you can feel the `thinking` state.

## Working on a desktop monitor

The app is locked to portrait **1080 × 1920**. To inspect it from a laptop:

1. Chrome DevTools → toggle device mode (Ctrl+Shift+M).
2. Add a custom device: 1080 × 1920, DPR 1.0, mobile (touch).
3. Or run Chrome with `--window-size=1080,1920`.

The kiosk lifecycle hook disables pinch-zoom, context menu, pull-to-refresh, and
text selection. To inspect freely during dev, set
`NEXT_PUBLIC_DISABLE_KIOSK_GUARDS=true` in `.env.local`.

## File map (high level)

```
app/                Next.js routes — page.tsx is the kiosk; api/chat is the n8n proxy
components/         character/, ui/, input/
hooks/              MediaRecorder, lipsync, analysers, idle timer, kiosk lifecycle, wake lock
lib/                Zustand store, side-effect actions, language detection, audio helpers
lib/mocks/          MSW handlers + sample audio fixtures
public/             grain.svg, self-hosted fonts, favicon
tests/              Vitest unit tests for the parts that need them
SETUP.md            this file
KIOSK.md            on-site deployment + recovery
```

## Linting / formatting

Prettier with `prettier-plugin-tailwindcss`, ESLint with `next/core-web-vitals` and
`@typescript-eslint/strict`. Pre-commit via husky + lint-staged.

## Browser permissions in dev

The mic permission prompt appears on first use. Chrome remembers the answer per origin.
If you accidentally deny, reset it at `chrome://settings/content/microphone`.

## Troubleshooting

- **Mic permission stuck**: `chrome://settings/content/microphone` → remove `localhost`.
- **No lipsync on first reply**: confirm `<audio>` was created inside the touch handler
  (gesture chain). Browsers block `play()` otherwise. The hook does this — only an
  issue if you've refactored.
- **Arabic text shows as boxes / disconnected glyphs**: Noto Naskh Arabic is loaded via
  `next/font/local` from `public/fonts/`. Confirm the file is present and that
  `font-feature-settings: "calt", "liga", "curs"` is applied to the `.ar` class.
- **Audio plays but the mouth doesn't move**: open the DevTools Performance tab —
  wawa-lipsync uses `requestAnimationFrame` and pauses when the tab is backgrounded.
  Bring the tab to foreground, or set `NEXT_PUBLIC_DISABLE_KIOSK_GUARDS=true` so the
  visibility-change handler doesn't reset state.
- **CORS error from `/api/chat`**: it's a same-origin Next route. If you see CORS,
  you probably hit the n8n URL directly from the browser — don't.
- **MediaRecorder error on Safari**: Safari emits `audio/mp4`. The recorder hook probes
  for the first supported mime in [opus, webm, mp4, ogg]. Confirm the chosen mime is
  forwarded to n8n in the multipart filename so STT picks the right decoder.
