# Watchtower

A dashboard for monitoring RAM pressure across all files in a Figma workspace. The Figma editor has a 2 GB RAM limit — large files cause performance issues as they approach this ceiling. Watchtower shows which files are in the danger zone.

## How It Works

A daily cron job syncs all projects and files from Figma into a local SQLite database. Each file is analyzed in two passes:

**Fast scan** — Runs automatically on every sync. Sends a lightweight request to the Figma API with `depth=2&geometry=omit` and calculates a relative complexity score from page, frame, and component counts.

**Deep scan** — Runs automatically for new and stale files (configurable threshold, default 7 days). Downloads the full file JSON, measures its byte size, and estimates RAM usage as `JSON size × 7 ≈ estimated RAM`, expressed as a ratio against the 2 GB limit. Can also be triggered on demand per file.

**Risk levels:**
- Green — below 40% (~820 MB)
- Amber — 40–70% (~820 MB – 1.4 GB)
- Red — above 70% (> ~1.4 GB, danger zone)
- Exceeded — over the 2 GB limit

**Library detection** — Files with published components are automatically detected via the Figma team components API (falls back to a `componentCount ≥ 50` heuristic for non-org plans) and marked with a `lib` badge.

**Branch awareness** — Branches are synced and deep scanned alongside main files. Files with branches show an expandable `⎇ N` panel with per-branch RAM, delta vs. the parent file, last modified date, and a stale badge for branches inactive for 60+ days.

## Setup

### 1. Create a Figma OAuth App

Go to [figma.com/developers/apps](https://www.figma.com/developers/apps) and create a new app.

- **Callback URL:** `http://localhost:5173/oauth/callback`
- **Required scopes:** `current_user:read`, `file_content:read`, `file_metadata:read`, `projects:read`

### 2. Find Your Team IDs

Open a team page in Figma: `figma.com/files/team/TEAM_ID/...` — copy the numeric ID from the URL.

### 3. Configure Environment Variables

```env
# Figma OAuth — from figma.com/developers/apps
FIGMA_CLIENT_ID=your_client_id
FIGMA_CLIENT_SECRET=your_client_secret
FIGMA_REDIRECT_URI=http://localhost:5173/oauth/callback

# Comma-separated team IDs to monitor
VITE_FIGMA_TEAM_IDS=123456789,987654321

# Comma-separated project names to monitor — leave empty to monitor all
WATCH_PROJECTS=Kripto Main,SSO Main,Hisse Main

# Optional
PORT=3001
DB_PATH=./data/watchtower.db
SYNC_CRON=0 6 * * *
STALE_SCAN_DAYS=7
```

### 4. Run

```bash
npm install
npm run dev      # Vite :5173 + Express :3001
```

On first launch, click "Connect Figma" to complete the OAuth flow. An initial sync starts automatically once connected.

## Docker

```bash
# copy and fill in your .env, then:
docker compose up -d
```

The database is persisted in a named Docker volume (`watchtower_data`).

## Production

```bash
npm run build
NODE_ENV=production npm start
```

In production, Express serves both the API and the React bundle from `/dist`.

## Project Structure

```
server/
├── index.ts        # Express API, OAuth endpoints, cron, health check, rate limiting
├── sync.ts         # Sync orchestration (fast scan, deep scan, library detection, branches)
├── auth.ts         # OAuth token management and auto-refresh
├── figmaApi.ts     # Figma API wrappers, metrics calculation
└── db/
    ├── index.ts    # SQLite connection, WAL mode, migration runner
    └── schema.ts   # Drizzle schema definitions

src/
├── App.tsx
├── components/
│   ├── FilesTable.tsx    # Main table with expandable branch panel
│   ├── ProjectCards.tsx  # Project summary cards with risk chips
│   ├── SortControls.tsx  # Search, filter, sort (single row)
│   ├── RamBar.tsx        # RAM pressure bar
│   └── BranchRow.tsx     # Legacy file row (accordion view)
└── lib/
    └── metrics.ts        # RAM pressure, color, risk level calculations
```

## Database Schema

| Table | Contents |
|-------|----------|
| `projects` | Figma project list |
| `files` | Files within each project (`is_library` flag included) |
| `fast_metrics` | Page/frame/component counts, complexity score |
| `deep_metrics` | JSON size, node count, estimated RAM, scan timestamp |
| `branches` | Branch list per file with RAM, last modified, scan timestamp |
| `oauth_tokens` | Access/refresh tokens (server-side only) |
| `sync_log` | Record of every sync attempt |

## API

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Uptime, last sync info, DB file size |
| `GET /api/auth/status` | Connection status |
| `GET /api/auth/connect` | Start Figma OAuth flow |
| `POST /api/auth/logout` | Clear tokens |
| `GET /api/data` | All projects, files, metrics, and branches |
| `POST /api/sync` | Trigger a manual sync |
| `GET /api/sync/status` | Sync status and last run info |
| `POST /api/files/:key/deep-scan` | Deep scan a single file on demand (rate limited: 10 req/min) |

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend:** Express 5 + TypeScript
- **Database:** SQLite (better-sqlite3) + Drizzle ORM
- **Scheduler:** node-cron
