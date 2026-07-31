# AGENTS.md

## Purpose

This file is the operational guide for AI agents and maintainers working on Emma Node. Keep it aligned with the repository whenever architecture, commands, runtime behavior, or migration status changes.

The objective is to port Hybrid Emma from Python/FastAPI and static HTML to Node.js/Fastify and React while preserving its product behavior, security boundaries, and local-first persistence model.

## Source of truth

- Active implementation: repository root and `src/`.
- Migration reference: `reference/hybrid_emma/`.
- The reference directory is ignored by Git and must not be copied wholesale into the active application.
- Read the relevant Python endpoint, helper modules, tests, and legacy HTML before implementing its Node equivalent.
- Preserve behavior deliberately; do not translate Python syntax line by line or recreate the monolithic `server.py` structure.

## Current migration state

### Implemented

- Node ESM project using Node.js 22.12 or newer.
- Fastify application bootstrap and process entry point.
- React 19 frontend built with Vite.
- React equivalents for all eight legacy HTML pages.
- Shared application shell, branding, auth storage, and API client.
- Vite development proxy under `/api`.
- Fastify production serving for the built React SPA.
- All 22 FastAPI route signatures registered in Fastify.

### Deliberately not implemented

- Every handler in `src/routes/server.js` is empty by design.
- SQLite schema and persistence.
- Authentication, bearer sessions, and permissions.
- User administration.
- Conversation persistence.
- File management and RAG processing.
- RAG security and inconsistency detection.
- Model discovery, LangChain generation, and streaming.

Do not claim these features work merely because the frontend contains their controls or the Fastify routes exist.

## Known expected failure

`npm test` currently fails because `src/app.test.js` expects `/health` to return `{ "status": "ok" }`, while `/health` is intentionally empty.

This failure documents the next incomplete contract. Do not weaken or delete the assertion to make the suite green. Make it pass when the real health implementation is added.

`npm run check` and `npm run build` are expected to pass.

## Repository structure

- `src/server.js`
  - Runtime entry point.
  - Reads `PORT` and `HOST`.
  - Starts the Fastify application and logs startup failures.

- `src/app.js`
  - Builds the Fastify instance.
  - Registers the endpoint contract.
  - Serves `dist/` when it exists.
  - Provides the production SPA fallback for HTML navigation.

- `src/routes/server.js`
  - Current inventory of routes migrated from FastAPI.
  - Handlers are intentionally empty.
  - As implementation grows, split cohesive route groups into modules such as `auth`, `users`, `files`, `conversations`, and `chat`; keep a clear registration boundary.

- `src/lib/api.js`
  - Canonical frontend API client.
  - Adds bearer tokens, applies the development `/api` prefix, parses API errors, and manages local session keys.
  - Do not duplicate raw authenticated `fetch` logic across pages.

- `src/main.jsx`
  - Maps SPA paths and legacy `/ui/*.html` aliases to React pages.
  - The project currently avoids an external router; revisit only when route complexity justifies it.

- `src/components/`
  - Shared React shell, branding, and protected-page behavior.

- `src/pages/`
  - Page-level React components for login, home, chat variants, upload, admin, and documentation.

- `src/styles.css`
  - Shared visual system and responsive layouts.

- `public/assets/`
  - Versioned static assets reused from the legacy frontend.

- `reference/hybrid_emma/`
  - Local reference implementation.
  - Never modify it as part of the Node port unless the user explicitly requests a reference change.

## Commands

```powershell
npm install
npm run dev
npm run dev:client
npm run check
npm test
npm run build
npm start
```

- `npm run dev`: Fastify with Node watch mode, default `127.0.0.1:8000`.
- `npm run dev:client`: Vite, normally `localhost:5173`.
- `npm run check`: TypeScript checking over JavaScript and JSX.
- `npm test`: Vitest; currently has the intentional health failure described above.
- `npm run build`: production React build.
- `npm start`: Fastify without watch mode; serves `dist/` when already built.

For a non-default backend port, keep the values aligned:

```powershell
$env:PORT=8650
npm run dev
```

```env
VITE_BACKEND_URL=http://127.0.0.1:8650
```

Use `.env.local` for the latter. It is ignored by Git. `.env.example` must remain safe and contain no real secrets.

## HTTP contract

The Fastify routes must preserve these paths and methods unless the product contract is intentionally changed:

### Authentication

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`

### User administration

- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/:target_user_id`
- `POST /admin/users/:target_user_id/reset-password`
- `DELETE /admin/users/:target_user_id`

### Health and models

- `GET /health`

### Files and RAG

- `GET /files`
- `POST /upload`
- `DELETE /files/:scope/:stem`
- `DELETE /files/:scope`
- `GET /files/:scope/:stem/download`

### Conversations and chat

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:conv_id`
- `PATCH /conversations/:conv_id/title`
- `DELETE /conversations/:conv_id`
- `POST /chat`

### Static

- `GET /favicon.ico`

Fastify uses `:parameter` syntax where FastAPI used `{parameter}`.

## Frontend contracts

React paths:

- `/login`
- `/`
- `/chat`
- `/chat-evil`
- `/chat-white`
- `/upload`
- `/admin`
- `/docs`

The chat variants share one stateful component and differ through a `variant` prop. Preserve this reuse when changing conversation or streaming behavior.

The frontend already assumes the reference API response shapes. When implementing endpoints, confirm those shapes against the Python reference and tests rather than changing the React code for convenience.

Development API calls must continue through `/api`. Vite rewrites that prefix before proxying to Fastify. This avoids collisions between React `GET /chat` navigation and backend `POST /chat` generation.

## Required product behavior to preserve

### Roles

- `admin`: user management plus global and user RAG management.
- `user`: chat and management of their own RAGs.
- `read_only`: chat only; no upload access.

Frontend visibility is a convenience. Every permission must be enforced again in Fastify.

### Authentication

- Bearer sessions are server-side and persisted locally.
- Disabled users cannot log in.
- Admin-created and reset passwords set `must_change_password`.
- While password replacement is required, only the minimal auth endpoints are accessible.
- Changing a password requires the current password, a different new password of at least eight characters, and invalidation of other sessions.
- Never introduce browser `prompt()` dialogs for password reset; use application modals.

### Persistence

- Keep the application local-first.
- SQLite remains the primary database unless the user explicitly changes the architecture.
- Runtime databases, RAG files, chunks, indexes, and logs are ignored by Git.
- Prefer small persistence modules instead of rebuilding one large server file.

### RAG

- Accept plain-text source files.
- Store chunks as JSON; embeddings and `.npy` files are not part of the current target behavior.
- Context selection preserves source order, keeps chunks whole, observes the configured character budget, and stops before the first chunk that would exceed it.
- Do not silently truncate admitted chunks.
- High-risk prompt-injection sources must never enter chat context.
- Missing security assessments may be created lazily before a source becomes eligible for chat.
- When no visible safe chunks exist, use general chat mode without grounding tags.
- Treat inserted RAG text as untrusted context and preserve explicit context delimiters or an equivalent defense.

### Chat

- Model access goes through a thin LangChain boundary.
- Supported provider families are Ollama-compatible local models, Gemini, OpenAI, and Anthropic.
- API keys stay on the server.
- Streaming uses newline-delimited JSON.
- The current React parser accepts the reference stream shape `{ "text": string, "done": boolean }` and several compatible delta shapes.
- Persist the user message and final assistant response exactly once.
- RAG-mode answers use `[RAG]`, `[DRIFT]`, or `[NO INFO]` according to the reference policy.
- General-mode answers must not expose those tags.

### Auditing

- Preserve chat safety, RAG security, and exception audit logs.
- Never log API keys or bearer tokens.
- Retain bounded log rotation behavior.
- High-risk RAG records and suspicious chat assessments require enough metadata to investigate without exposing secrets unnecessarily.

## Implementation method

For each backend slice:

1. Read the relevant Python endpoint and every helper it invokes.
2. Read the reference tests covering that behavior.
3. Identify persistence, filesystem, async, security, and role interactions.
4. Define Zod schemas for request inputs and important persisted structures.
5. Implement the smallest cohesive Fastify plugin or service boundary.
6. Port or add tests before moving to the next slice.
7. Run type checks, targeted tests, the full suite, and the production build.
8. Update README and this file when commands, structure, or migration status changes.

Do not implement several major backend domains in one unreviewable change.

## Code conventions

- Use English for source code, identifiers, comments, logs, API messages, and UI copy unless multilingual content is functionally required.
- Use ESM imports and explicit `.js` extensions for local modules.
- Prefer functions and small Fastify plugins over state-less classes.
- Keep route handlers thin; move persistence, policy, model, and filesystem concerns into cohesive modules.
- Add concise JSDoc where it improves JavaScript type checking.
- Keep `npm run check` passing when possible.
- Do not add placeholder success responses that make an unimplemented endpoint appear functional.
- Do not bypass security or permissions to make the React UI easier to demo.

## Secrets and ignored data

Never commit or expose:

- `.env`, `.env.local`, or other real environment files
- `api_keys.json`
- `emma.db` or SQLite sidecars
- `files/`, `chunks/`, indexes, or runtime logs
- bearer tokens or password hashes
- `reference/`

`package-lock.json` must remain versioned.

## Git discipline

- Do not commit or push unless the user explicitly requests it.
- Inspect `git status`, `git diff --check`, and the staged diff before committing.
- Preserve unrelated user changes.
- Never use destructive reset or checkout commands without explicit authorization.
- The repository may require `git -c safe.directory="C:/Users/dazju/Desktop/grandes hitos/emma_node" ...` because Codex and the Windows user have different ownership identities.

## Documentation maintenance

When behavior changes, update both:

- `README.md` for human setup, commands, status, and architecture.
- `AGENTS.md` for implementation rules, contracts, migration state, and agent workflow.

Remove completed items from the deliberately-unimplemented list only after their implementations and tests exist.
