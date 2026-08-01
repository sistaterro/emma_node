# Emma Node

Emma Node is the completed Node.js/Fastify and React port of Hybrid Emma.

The React interface and Fastify backend implement the legacy product contract with local SQLite persistence, scoped knowledge files, RAG safety, provider-independent model generation, and NDJSON chat streaming.

## Current status

| Area | Status |
| --- | --- |
| React/Vite application | Migrated |
| Legacy page aliases | Migrated |
| Fastify server bootstrap | Working |
| Static production frontend | Working after `npm run build` |
| API endpoints | Implemented and integration tested |
| Chat policies and prompt builders | Ported and unit tested |
| RAG security and conflicts | Integrated and tested |
| Health and model catalog | Implemented and unit tested |
| Authentication, sessions, and authorization | Implemented and unit tested |
| SQLite schema and lifecycle | Implemented and unit tested |
| Domain persistence repositories | Implemented |
| File and RAG pipeline | Implemented |
| LangChain generation and streaming | Implemented |

On a new database, sign in with `admin` / `admin1234`. Emma immediately requires replacing that temporary password before protected workspace routes become available.

## Requirements

- Node.js 22.12 or newer
- npm

The project is tested locally with Node.js 24.

## Installation

```powershell
npm install
```

Copy the environment example when the frontend and backend do not use the default ports:

```powershell
Copy-Item .env.example .env.local
```

The default development backend URL is:

```env
VITE_BACKEND_URL=http://127.0.0.1:8650
```

For a backend running on port `8650`, change it to:

```env
VITE_BACKEND_URL=http://127.0.0.1:8650
```

## Development

Run the backend in one terminal:

```powershell
npm run dev
```

The backend reads `HOST` and `PORT`. To use port `8650` in PowerShell:

```powershell
$env:PORT=8650
npm run dev
```

Run React in another terminal:

```powershell
npm run dev:client
```

Vite normally opens at [http://localhost:5173](http://localhost:5173). Development API requests use the `/api` proxy, preventing backend endpoints such as `POST /chat` from colliding with React pages such as `GET /chat`.

## React routes

| Route | Migrated source |
| --- | --- |
| `/login` | `login.html` |
| `/` | `index.html` |
| `/chat` | `chat.html` |
| `/chat-evil` | `chat_evil_emma.html` |
| `/chat-white` | `chat_not_so_evil_emma_white.html` |
| `/upload` | `upload.html` |
| `/admin` | `admin.html` |
| `/docs` | `Docs.html` |

The old `/ui/*.html` paths are also translated to their React equivalents by the client entry point.

## Production build

```powershell
npm run build
npm start
```

Fastify serves the generated `dist/` directory and returns `index.html` for client-side React routes.

## Verification

```powershell
npm run check
npm test
npm run test:unit
npm run test:integration
npm run build
```

`npm run check`, `npm test`, and `npm run build` pass at the current migration stage.

## Project structure

```text
public/assets/          Static images and favicons
src/components/        Shared React components
src/lib/api.js          Auth storage and API client
src/pages/             React page components
src/chat-policy.js     Context budgeting and deterministic language replies
src/prompts.js         Canonical AI prompt builders
src/rag-security.js    RAG security normalization, indexes, and audit logs
src/auth/              Password, bearer-session, and authorization policies
src/routes/            Cohesive Fastify route plugins
src/db/                SQLite schema and repositories
src/files/             Scoped file-storage policies
src/rag/               Ingestion, context, security integration, and conflicts
src/models/            Catalog and LangChain provider boundary
src/chat/              Orchestration, streaming, and audit services
tests/unit/             Framework-independent unit tests
tests/integration/      Fastify, SQLite, filesystem, and route integration tests
src/app.js             Fastify application builder and SPA serving
src/server.js          Backend process entry point
src/main.jsx           React route selection and legacy aliases
vite.config.js         React plugin and development API proxy
reference/             Local Python migration source; ignored by Git
```

## Local and sensitive files

The following must remain outside version control:

- `reference/`
- `.env` and `.env.local`
- `api_keys.json`
- `emma.db` and SQLite sidecar files
- `files/`, `chunks/`, indexes, and runtime logs
- `node_modules/`, `dist/`, and coverage output

Never expose API keys through the frontend or health responses.

## Backend architecture

The backend was migrated in these independently tested slices:

1. Configuration, errors, SQLite initialization, and `/health`.
2. Authentication, sessions, forced password changes, and role enforcement.
3. Administrative user management. Implemented and covered by integration tests.
4. Conversation persistence. Implemented and covered by integration tests.
5. File upload, download, deletion, and RAG indexing. Implemented with JSON-only chunks.
6. RAG inconsistency and prompt-injection analysis.
   Inconsistency records are persisted and pruned when their sources disappear.
   RAG prompt-injection findings are persisted, audited, and high-risk sources are excluded from chat context.
7. LangChain model discovery, generation, and NDJSON streaming.
   Chat now applies safe visible context, response tags, safety auditing, and conversation persistence.

The historical Python implementation remains locally under `reference/hybrid_emma` as ignored maintenance reference only. No application runtime imports or executes it.
