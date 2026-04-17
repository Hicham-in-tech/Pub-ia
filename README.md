# chat.fpt.ia

Rouda voice kiosk for FPT Taroudant, now running fully in Next.js (no n8n dependency).

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env.local` from `.env.example` and fill API keys:

- `MISTRAL_API_KEY`
- `GROQ_API_KEY`
- `ELEVENLABS_API_KEY`

3. Start development server:

```bash
pnpm dev
```

4. Open `http://localhost:3000`.

## Architecture

- `app/api/chat`: full backend pipeline
- Audio input -> Groq STT
- FAQ retrieval from local dataset (`lib/data/fptFaqs.json`)
- Response generation via Mistral
- Voice output via ElevenLabs and cached on `app/api/audio/[id]`

See `SETUP.md` for full developer setup and `KIOSK.md` for production deployment.
# Pub-ia 
