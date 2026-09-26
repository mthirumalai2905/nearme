# Near Me

Temporary, private location sharing. Create a session, send the link, and see everyone on one map.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and add your Supabase URL and publishable key. The database password belongs only in `.env.local` as `SUPABASE_DB_PASSWORD`. Never commit it, and never prefix it with `NEXT_PUBLIC_`.

Apply the schema:

```bash
npm run migrate
```

In the Supabase SQL editor this is `supabase/migrations/001_sessions.sql`. Running it again drops and recreates Near Me sessions.

The direct database host is often IPv6-only. If it does not resolve, use the session pooler host from the Supabase dashboard on port 5432.

## How access works

There are no accounts. A session link is the way in. Each person gets a token stored only in their browser. Database tables are locked with row level security and are not readable with the public key. All reads and writes go through checked database functions.

Location is sent only after someone chooses **Share location**. The browser is asked after that choice, not before. Closing the page stops updates. The last point drops off the map after a few minutes. Ending or expiring a session deletes live locations.

Sessions last 8 hours unless the creator ends them sooner.

## Maps and meeting places

The live map is Leaflet with OpenStreetMap, so people line up with real roads and buildings. No map API key is required. Optional `NEXT_PUBLIC_MAP_TILE_LIGHT` and `NEXT_PUBLIC_MAP_TILE_DARK` can replace those tiles. Meeting places come from OpenStreetMap. Optional `LLM_API_KEY` can write a short reason for those real places. It cannot invent locations.

## Checks

```bash
npm test
npm run lint
npm run build
```
