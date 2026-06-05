# Audiobook Player Web App

Paste a URL of an audiobook page (HTML list of MP3/M4A/M4B files) or an M3U/M3U8 playlist and start listening. Chapters are extracted on the server, playback is handled in the browser, and progress is saved to Supabase so you can resume on any device.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4
- Supabase (Google OAuth + Postgres for progress)
- `cheerio` for server-side HTML parsing

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env file and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```
3. Create the `progress` table in Supabase (SQL editor → New query):
   ```bash
   psql "$DATABASE_URL" -f supabase/schema.sql
   # or paste the contents of supabase/schema.sql into the Supabase SQL editor
   ```
4. Enable Google auth in Supabase: Authentication → Providers → Google, and add `/auth/callback` to the redirect allow-list.
5. Start the dev server:
   ```bash
   npm run dev
   ```

## How it works

- The home page posts a URL to `/api/extract-mp3`. The route fetches the page server-side, parses it with `cheerio`, and returns a structured `AudiobookPlaylist`.
- The playlist is encoded into the query string of `/player` so a single bookmark works for any audiobook.
- `AudioPlayer` plays chapters sequentially, exposes play/pause, 15s skip, speed (0.75–2x), chapter nav, and a chapter list.
- When signed in, every change is debounced-saved to Supabase via a server action; on `beforeunload` we flush the latest position.
- When revisiting the same source URL, the player restores the chapter, timestamp, and speed automatically.
