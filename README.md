# Emma Node

Emma Node is an in-progress migration of Hybrid Emma from a Python/FastAPI application to a Node.js stack built with Fastify and React.

The React interface has been migrated. The Fastify HTTP contract is present, but its endpoint handlers are intentionally empty while the backend is ported incrementally from the local reference implementation.

## Current status

| Area | Status |
| --- | --- |
| React/Vite application | Migrated |
| Legacy page aliases | Migrated |
| Fastify server bootstrap | Working |
| Static production frontend | Working after `npm run build` |
| API route signatures | Registered with empty handlers |
| Chat policies and prompt builders | Ported and unit tested |
| RAG security module | Ported and unit tested; not integrated |
| Authentication and authorization | Not implemented |
| SQLite schema and lifecycle | Implemented and unit tested |
| Domain persistence repositories | Not implemented |
| File and RAG pipeline | Not implemented |
| LangChain generation and streaming | Not implemented |

Because authentication is not implemented yet, only the login screen can currently be explored normally. Protected React routes call `/auth/me` and redirect to login when no valid backend session is available.

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
npm run build
```

`npm run check` and `npm run build` pass at the current migration stage.

`npm test` currently fails intentionally: the existing test expects `/health` to return `{ "status": "ok" }`, while every migrated endpoint handler is deliberately empty. Update that test only when `/health` receives its real implementation.

## Project structure

```text
public/assets/          Static images and favicons
src/components/        Shared React components
src/lib/api.js          Auth storage and API client
src/pages/             React page components
src/chat-policy.js     Context budgeting and deterministic language replies
src/prompts.js         Canonical AI prompt builders
src/rag-security.js    RAG security normalization, indexes, and audit logs
src/routes/server.js   Empty Fastify endpoint contract
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

## Backend migration approach

The backend should be implemented in small, testable slices. A practical order is:

1. Configuration, errors, SQLite initialization, and `/health`.
2. Authentication, sessions, forced password changes, and role enforcement.
3. Administrative user management.
4. Conversation persistence.
5. File upload, download, deletion, and RAG indexing.
6. RAG inconsistency and prompt-injection analysis.
7. LangChain model discovery, generation, and NDJSON streaming.

The reference behavior lives locally under `reference/hybrid_emma`, but that directory is migration input rather than application code.
