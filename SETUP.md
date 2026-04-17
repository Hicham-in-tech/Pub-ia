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
# LLM answer generation (server-only)
MISTRAL_API_KEY=<your-mistral-api-key>
# Optional (default shown)
MISTRAL_MODEL=mistral-large-latest

# Speech-to-text for voice input (server-only)
GROQ_API_KEY=<your-groq-api-key>
# Optional (default shown)
GROQ_STT_MODEL=whisper-large-v3-turbo

# Text-to-speech for voice output (server-only)
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
# Optional (defaults shown)
ELEVENLABS_VOICE_ID=iP95p4xoKVk53GoZ742B
ELEVENLABS_MODEL_ID=eleven_flash_v2_5

# Optional: force MSW mock mode in development (default: false)
NEXT_PUBLIC_USE_MOCKS=false

# Optional: relax kiosk hardening (zoom, context menu, etc.) for dev inspection
NEXT_PUBLIC_DISABLE_KIOSK_GUARDS=false
```

Production env on Vercel: set `MISTRAL_API_KEY`, `GROQ_API_KEY`, and `ELEVENLABS_API_KEY` (scope = Production).

## Scripts

```bash
pnpm dev          # Next.js dev server on http://localhost:3000
pnpm dev:mock     # Same, with NEXT_PUBLIC_USE_MOCKS=true (offline, MSW-served fake backend)
pnpm build        # Production build
pnpm start        # Run the production build locally
pnpm test         # Vitest unit tests
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
```

## Pointing at live backend vs mock

- `pnpm dev` runs the real Next.js backend on `/api/chat`:
  - text and audio go to the local route
  - audio input is transcribed with Groq STT
  - response is generated from local FPT FAQs + Mistral
  - audio output is synthesized with ElevenLabs
- `pnpm dev:mock` intercepts `/api/chat` with MSW and returns synthetic responses/audio.
  No network needed — useful for working on character + UI in transit / offline.

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
app/                Next.js routes — page.tsx is the kiosk; api/chat is the full backend
components/         character/, ui/, input/
hooks/              MediaRecorder, lipsync, analysers, idle timer, kiosk lifecycle, wake lock
lib/                Zustand store, language detection, FAQ retrieval, STT/TTS/LLM clients
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
  you probably called a third-party API directly from the browser instead of using `/api/chat`.
- **MediaRecorder error on Safari**: Safari emits `audio/mp4`. The recorder hook probes
  for the first supported mime in [opus, webm, mp4, ogg]. Confirm the chosen mime is
  forwarded to `/api/chat` in the multipart filename so STT picks the right decoder.
