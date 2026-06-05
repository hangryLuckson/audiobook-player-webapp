# Audiobook Player Web App

A single-user audiobook player. Paste a URL, listen with full controls, and your library + progress sync across every device you sign in on.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4
- Supabase (Postgres for library + progress, service-role key for single-user access)
- `cheerio` for server-side HTML parsing
- Media Session API for OS-level playback controls

## Features

- **Library** — every audiobook you open is saved. Browse, resume, or delete from one place. The library is the default landing page.
- **Cross-device sync** — chapter, timestamp, speed, and library entries are stored in Postgres. Open the same URL on another device and resume exactly where you left off.
- **Sleep timer** — auto-starts at 45 minutes when you press play. Click the moon icon to pick 15/30/45/60/90 minutes or turn it off. When the timer ends, playback pauses.
- **Full player controls** — play/pause, prev/next chapter, ±15s skip, scrub bar, speed (0.75–2x), chapter list.
- **Auto-resume** — chapter, timestamp, and speed restore on reload.
- **Reliable saves** — debounced 800ms save on every state change, plus `sendBeacon` on tab close/hide.
- **Media Session integration** — the browser shows the current chapter in the OS media controls (lock screen, notification shade, headphones buttons) with play/pause/seek/next/prev.
- **Audio proxy** — server-side re-streaming so audio works even when the source blocks hot-linking.
- **SSRF protection** — the extractor pre-resolves hostnames and rejects private/loopback/link-local IPs, has a timeout, body cap, and manual redirect handling.
- **Single-user password** — set `APP_PASSWORD` and you're done. No Supabase Auth rate limits, no OAuth dance.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env file and fill in your values:
   ```bash
   cp .env.local.example .env.local
   ```
   You need:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same place
   - `SUPABASE_SERVICE_ROLE_KEY` — same place (keep this secret, never expose to the browser)
   - `APP_PASSWORD` — anything you want; this is the only login

3. Run the SQL in Supabase (Project → SQL Editor → New query):
   ```bash
   # paste the contents of supabase/schema.sql
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`, sign in with `APP_PASSWORD`, paste an audiobook URL on `/add`, hit "Add".

## Deploy to Vercel

1. Push to GitHub: `git push origin main` (or use the GitHub web UI).
2. Go to https://vercel.com/new and import the repo.
3. In **Environment Variables**, add the same four values from `.env.local`.
4. Deploy. Vercel gives you a URL like `https://audiobook-player-webapp-xxxx.vercel.app`. The first deploy takes ~1 minute; subsequent deploys are faster.

## How it works

- The home page is `/` and just redirects to `/library`. New audiobooks are added from `/add`.
- `/api/extract-mp3` is server-side only and auth-gated. It fetches the page on the server, parses it with `cheerio`, and returns a structured `AudiobookPlaylist`.
- The playlist is saved to the `audiobooks` table on first open and looked up by source URL thereafter. Player URLs are stable: `/player?url=<source>`.
- Progress is debounced-saved to `progress` on every state change and flushed via `sendBeacon` on unload.
- The sleep timer runs in a 1s interval, auto-starts at 45m on first play, and pauses the audio when it hits zero.
- Media Session metadata is updated on chapter change so OS-level controls stay in sync.
