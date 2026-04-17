# Rouda — Kiosk Deployment

Run-of-show for the FPT Taroudant orientation event (April 2026).
For dev setup, see `SETUP.md`.

---

## Hardware target

- Vertical touchscreen, 43" or 55", **portrait orientation**.
- Native resolution **1080 × 1920** (preferred) or **2160 × 3840** (4K vertical). The
  layout is built with `clamp()` and viewport units — no media-query swap.
- Capacitive touch only. No mouse or keyboard reachable to the public.
- Wired ethernet preferred (Wi-Fi as fallback) — STT/LLM/TTS APIs are internet-backed.
- Permanent power. No battery.
- Speakers loud enough to hear from 1–2m in a busy event hall (built-in panel speakers
  are usually too quiet — bring a powered pair).
- Microphone: USB cardioid, mounted ~30cm in front of the screen, pointed where users
  stand. Built-in laptop / panel mics are not acceptable.

## Hosting

Production app on Vercel.

```
Vercel → Project → Settings → Environment Variables
  MISTRAL_API_KEY = <your-mistral-api-key>
  GROQ_API_KEY = <your-groq-api-key>
  ELEVENLABS_API_KEY = <your-elevenlabs-api-key>
  ELEVENLABS_VOICE_ID = iP95p4xoKVk53GoZ742B   # optional
  ELEVENLABS_MODEL_ID = eleven_flash_v2_5      # optional
  GROQ_STT_MODEL = whisper-large-v3-turbo      # optional
  MISTRAL_MODEL = mistral-large-latest         # optional
  Scope: Production
```

Custom domain (e.g. `rouda.fpt-taroudant.zyllux.com`) recommended — easier to type into
the kiosk's Chrome on first setup, and survives Vercel preview-URL churn.

## Chrome kiosk launch

### Linux / ChromeOS (recommended for the event)

```bash
google-chrome \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --disable-features=TranslateUI,Translate \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --start-fullscreen \
  --incognito \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --check-for-update-interval=31536000 \
  https://rouda.fpt-taroudant.zyllux.com
```

Why these flags:

- `--kiosk` removes all browser chrome.
- `--use-fake-ui-for-media-stream` auto-grants the mic permission.
  **Only safe on a locked kiosk** that doesn't browse the open web.
- `--autoplay-policy=no-user-gesture-required` ensures TTS playback never gets blocked.
  The app still pre-creates the `<audio>` element inside the touch gesture chain as a
  belt-and-braces fallback for browsers that ignore the flag.
- `--incognito` ensures every session starts clean. The app regenerates `sessionId` per
  visitor, but incognito guarantees no cookie/storage carryover from earlier crashes.
- `--check-for-update-interval=31536000` defers Chrome auto-update by a year — no
  surprise restarts during the event.
- `--disable-pinch` blocks pinch-zoom at the browser level (the app blocks it too).

### Windows

Use the same flags via a `.bat` shortcut pointing at `chrome.exe`:

```bat
@echo off
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk --noerrdialogs --disable-infobars ^
  --autoplay-policy=no-user-gesture-required ^
  --use-fake-ui-for-media-stream --start-fullscreen --incognito ^
  --overscroll-history-navigation=0 --disable-pinch ^
  --check-for-update-interval=31536000 ^
  https://rouda.fpt-taroudant.zyllux.com
```

OS settings:

- Auto-login the kiosk user.
- Disable Windows Update during event days (Active Hours covering the entire event).
- Disable lock screen and screensaver.
- Place the `.bat` in the Startup folder (`shell:startup`).
- Disable edge-swipe touch gestures (Settings → Devices → Touchpad / Pen & Windows Ink).

### Auto-restart on crash (Linux)

Wrap the Chrome launch in a tiny supervisor:

```bash
#!/usr/bin/env bash
# /usr/local/bin/rouda-kiosk.sh
while true; do
  google-chrome --kiosk ... https://rouda.fpt-taroudant.zyllux.com
  sleep 2
done
```

Run it from `~/.config/openbox/autostart` or the equivalent for your WM. If Chrome ever
exits, it relaunches in 2s. The app's error boundary catches React crashes and shows a
"Touchez pour recommencer" screen that reloads on tap, so Chrome should rarely actually
exit.

## Operating system hardening

- Disable system notifications globally.
- Disable accessibility shortcuts (sticky keys, magnifier, narrator) — accidental palm
  presses on a touchscreen can trigger them.
- Disable USB autoplay.
- Turn off Bluetooth discovery.
- Power: never sleep, never dim the screen, never lock.
- Hide the cursor when idle: `unclutter -idle 0 -root` on Linux, AutoHideMouseCursor on
  Windows.
- Disable the on-screen keyboard auto-popup (iOS users: it's not iOS, but check Linux
  GNOME/KDE settings — some distros pop a virtual keyboard on focus).

## What the app already prevents

The kiosk lifecycle hook blocks at the application layer:

- Pinch zoom (viewport meta + `touch-action: manipulation`).
- Context menu (right-click / long-press).
- Pull-to-refresh (`overscroll-behavior: none`).
- Text selection (`user-select: none`, except inside the text drawer textarea).
- Tap-highlight flash.
- Accidental navigation (`beforeunload` handler).
- Idle screen sleep (`navigator.wakeLock.request('screen')`, re-requested on
  visibilitychange).

You don't need to do these at the OS level too, but doing both is fine.

## On-site recovery procedure

If the screen freezes during the event:

1. **First**: touch the screen anywhere. The app's error boundary shows
   "Touchez pour recommencer" and reloads on tap.
2. **If unresponsive**: a USB keyboard kept off-stage. `Ctrl+W` closes the tab; the
   supervisor script relaunches Chrome.
3. **If the browser is unresponsive**: open a terminal (Linux: `Ctrl+Alt+T`),
   `pkill chrome`. Supervisor relaunches.
4. **If the OS is frozen**: hard reboot. The startup script auto-launches Chrome in
   kiosk mode. Time-to-recovery: ~45 seconds.

Tape one printed copy of this section to the back of the kiosk panel.

## Pre-event checklist (24h before)

- [ ] `/api/chat` responding (`curl -X POST https://<your-domain>/api/chat -d '{"sessionId":"test","chatInput":"bonjour"}' -H 'Content-Type: application/json'`).
- [ ] Mic permission auto-granted on the kiosk machine (touch the mic, no permission prompt).
- [ ] Audio output volume at 75–85% — set on the OS, not the app.
- [ ] Mic input level visible in OS settings when speaking from 1m away.
- [ ] Arabic test message returns and renders correctly (right-to-left, Naskh shaping).
- [ ] French test message returns and renders correctly.
- [ ] Idle for 60s → attract mode triggers.
- [ ] Tap during attract → goes straight into listening, mic active.
- [ ] Disconnect ethernet → app shows graceful error (not a Chrome dino page).
- [ ] Reconnect ethernet → next interaction works.
- [ ] Wake lock holds for 10 minutes idle.
- [ ] No browser update prompt visible.
- [ ] Backup hotspot on standby.
- [ ] One printed copy of the on-site recovery procedure taped to the kiosk back panel.

## Network failure behavior

If `/api/chat` returns 502 (backend unreachable), the app shows Rouda in `error` state with
a one-line message in the user's last detected language:

- FR: "Désolée, je n'arrive pas à répondre maintenant. Réessayez dans un instant."
- AR: "آسفة، لا أستطيع الإجابة الآن. حاول مرة أخرى بعد قليل."

The mic stays armed — the next attempt may succeed if connectivity is back.

## Updating during the event

Don't, unless you have to. If you must:

1. Push to the Vercel-connected branch.
2. Wait for the deploy to finish (~30s).
3. Remote into the kiosk machine (SSH / VNC). `Ctrl+R` the Chrome window or restart
   the supervisor.

Never `git pull` on the kiosk itself — the kiosk doesn't have the repo, only Chrome
pointing at the deployed URL.
