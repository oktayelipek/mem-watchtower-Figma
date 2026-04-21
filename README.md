# Watchtower

A dashboard for monitoring RAM pressure across all files in a Figma workspace. The Figma editor has a 2 GB RAM limit — large files cause performance issues as they approach this ceiling. Watchtower shows which files are in the danger zone.

## How It Works

A daily cron job syncs all projects and files from Figma into a local SQLite database. Each file is analyzed in two passes:

**Fast scan** — Runs automatically on every sync. Sends a lightweight request to the Figma API with `depth=2&geometry=omit` and calculates a relative complexity score from page, frame, and component counts.

**Deep scan** — Runs on demand or automatically for new files. Downloads the full file JSON, measures its byte size, and estimates RAM usage as `JSON size × 7 ≈ estimated RAM`, expressed as a ratio against the 2 GB limit.

**Risk levels:**
- Green — below 40% (~820 MB)
- Amber — 40–70% (~820 MB – 1.4 GB)
- Red — above 70% (> ~1.4 GB, danger zone)
- Exceeded — over the 2 GB limit

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
```

### 4. Run

```bash
npm install
npm run dev      # Vite :5173 + Express :3001
```

On first launch, click "Connect Figma" to complete the OAuth flow. An initial sync starts automatically once connected.

## Production

```bash
npm run build
NODE_ENV=production node dist-server/index.js
```

In production, Express serves both the API and the React bundle from `/dist`.

## Project Structure

```
server/
├── index.ts        # Express API, OAuth endpoints, cron scheduler
├── sync.ts         # Sync orchestration
├── auth.ts         # OAuth token management and auto-refresh
├── figmaApi.ts     # Figma API wrappers, metrics calculation
└── db/
    ├── index.ts    # SQLite connection, WAL mode, migration runner
    └── schema.ts   # Drizzle schema definitions

src/
├── App.tsx
├── components/
│   ├── FilesTable.tsx    # Main table (RAM bar, score, scan age)
│   ├── ProjectCards.tsx  # Project summary cards with risk chips
│   ├── SortControls.tsx  # Search, filter, sort
│   ├── BranchRow.tsx     # File row component
│   └── RamBar.tsx        # RAM pressure bar
└── lib/
    └── metrics.ts        # RAM pressure, color, risk level calculations
```

## Database Schema

| Table | Contents |
|-------|----------|
| `projects` | Figma project list |
| `files` | Files within each project |
| `fast_metrics` | Page/frame/component counts, complexity score |
| `deep_metrics` | JSON size, node count, estimated RAM, scan timestamp |
| `oauth_tokens` | Access/refresh tokens (server-side only) |
| `sync_log` | Record of every sync attempt |

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/auth/status` | Connection status |
| `GET /api/auth/connect` | Start Figma OAuth flow |
| `POST /api/auth/logout` | Clear tokens |
| `GET /api/data` | All projects, files, and metrics |
| `POST /api/sync` | Trigger a manual sync |
| `GET /api/sync/status` | Sync status and last run info |
| `POST /api/files/:key/deep-scan` | Deep scan a single file on demand |

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend:** Express 5 + TypeScript
- **Database:** SQLite (better-sqlite3) + Drizzle ORM
- **Scheduler:** node-cron
