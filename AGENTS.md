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
- Pure chat policies for safe integer settings, whole-chunk context budgeting, language detection, and deterministic no-information replies.
- Canonical prompt builders for safety, RAG security, inconsistency comparison, grounded chat, and general chat.
- Standalone RAG security analysis, normalization, index pruning/persistence, lazy assessment, high-risk exclusion policy, and suspicious-RAG audit logging.
- Focused unit tests for the three ported peripheral modules.
- Centralized runtime configuration, local-directory initialization, CORS, consistent HTTP errors, exception auditing, and bounded exception-log rotation.
- Managed SQLite lifecycle, idempotent schema migration, foreign-key enforcement, and initial administrator bootstrap.
- Provider-key resolution, Ollama model discovery with timeout/fallback, model resolution, and the `/health` response contract.
- Bcrypt passwords, bearer sessions, forced temporary-password replacement, protected health access, and reusable role policies.

### Deliberately not implemented

- Every handler in `src/routes/server.js` is empty by design.
- Domain persistence repositories beyond the shared SQLite foundation.
- User administration.
- Conversation persistence.
- File management and RAG processing.
- Integration of RAG security into ingestion and chat.
- The inconsistency detection pipeline beyond its canonical prompt builder.
- Model discovery, LangChain generation, and streaming.

Do not claim these features work merely because the frontend contains their controls or the Fastify routes exist.

## Verification baseline

`npm run check`, `npm test`, and `npm run build` are expected to pass. Tests that inspect runtime configuration, SQLite, provider keys, or model discovery must use temporary paths and injected model catalogs; they must not depend on the developer's real `emma.db`, API keys, environment, or Ollama installation.

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

- `src/chat-policy.js`
  - Pure, framework-independent context budgeting and deterministic language policies.
  - Keeps chunks whole and ordered; never replace this with silent text truncation.

- `src/prompts.js`
  - Canonical location for the five AI prompt builders.
  - Keep active prompt text centralized here rather than embedding prompts in routes or model adapters.

- `src/rag-security.js`
  - Framework-independent RAG prompt-injection assessment and persistence policies.
  - Receives model catalog, model resolution, generation, and exception logging as injected functions.
  - It is implemented and unit tested but not yet wired into upload or chat endpoints.

- `src/auth/`
  - Canonical password, session, current-user, role normalization, and authorization policies.
  - `authenticateRequest` enforces disabled users and temporary-password route restrictions.

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

- `npm run dev`: Fastify with Node watch mode, default `127.0.0.1:8650`.
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

## Final migration stage: tracked technical debt

The remaining `server.py` migration is the final major stage of the port. Treat every item below as tracked technical debt until its implementation, integration, and tests exist in Node.

Work through the parts in order. A later part may depend on earlier infrastructure, permissions, or persistence. Do not migrate the entire Python server into one JavaScript file or one oversized change.

### Debt 1: runtime configuration and application infrastructure — closed

Status: completed and covered by focused tests. Keep the boundaries and completion criteria below as maintenance requirements.

Scope:

- Centralize environment parsing, ports, model URLs, context limits, and runtime paths.
- Register `@fastify/cors` and the global Fastify error handler.
- Create filesystem directories safely during application startup.
- Port bounded exception-log persistence and rotation.
- Keep application construction testable without opening a network port.

Expected boundaries:

- `src/config.js`
- `src/plugins/error-handler.js`
- Small filesystem or logging helpers where justified

Completion criteria:

- Invalid environment values fall back safely.
- Errors have consistent JSON responses.
- Unhandled server errors are logged without leaking secrets.
- Startup and shutdown work in tests and in the real process.

### Debt 2: SQLite schema and persistence foundation — closed

Status: completed and covered by temporary-database tests. Keep real domain queries in the repositories introduced by later debt blocks.

Scope:

- Open the local database through `better-sqlite3`.
- Port schema initialization for users, sessions, conversations, and messages.
- Preserve foreign-key and deletion behavior from the reference implementation.
- Provide explicit transaction boundaries and close the database cleanly.
- Seed only the same required initial data as the Python reference.

Expected boundaries:

- `src/db/index.js`
- `src/db/schema.js`
- Focused repositories added only as their domains are implemented

Completion criteria:

- A temporary database can be initialized from nothing.
- Schema initialization is repeatable.
- Tests do not touch the real `emma.db`.
- SQL remains parameterized; no request value is interpolated into SQL text.

### Debt 3: health and model catalog — closed

Status: completed and covered by deterministic catalog and route tests. Authentication protection is added by Debt 4.

Scope:

- Implement `/health` with the reference response contract.
- Discover configured local Ollama-compatible models.
- Read external-provider availability without exposing API keys.
- Separate provider configuration from model resolution.

Expected boundaries:

- `src/models/catalog.js`
- `src/routes/health.js`

Completion criteria:

- The existing health test passes with the real response.
- Local and external models use stable IDs and source labels.
- Responses contain provider/model metadata but never secret values.
- Failure of a local model runtime does not crash application startup.

### Debt 4: authentication, sessions, and authorization — closed

Status: completed and covered by route and policy tests, including session invalidation and forced password replacement.

Scope:

- Port bcrypt password hashing and verification.
- Implement bearer-session creation, lookup, and logout.
- Implement `/auth/login`, `/auth/logout`, `/auth/me`, and `/auth/change-password`.
- Enforce active users, normalized roles, and `must_change_password` restrictions.
- Add reusable admin, upload, ownership, and read-only policies.

Expected boundaries:

- `src/auth/passwords.js`
- `src/auth/sessions.js`
- `src/auth/authorization.js`
- `src/routes/auth.js`

Completion criteria:

- Authentication behavior matches the reference tests.
- Password replacement invalidates other sessions but preserves the current session.
- Protected endpoints reject missing, invalid, disabled, and restricted sessions correctly.
- Authorization is enforced by Fastify, never only by React.

### Debt 5: administrative user management

Scope:

- Implement list, create, update, password-reset, and delete user endpoints.
- Preserve username uniqueness, normalized roles, active state, and temporary-password behavior.
- Prevent unsafe deletion or modification scenarios handled by the reference server.

Expected boundaries:

- `src/db/users.js`
- `src/routes/users.js`
- Zod schemas for every request body

Completion criteria:

- The React admin screen works without response-shape changes.
- Admin-only enforcement is covered by tests.
- Renaming users and resetting passwords preserve the reference behavior.

### Debt 6: conversation persistence

Scope:

- Implement conversation list, create, read, rename, and delete endpoints.
- Persist messages in order and scope every operation to the current user.
- Preserve timestamps, IDs, model selection, and response shapes.

Expected boundaries:

- `src/db/conversations.js`
- `src/routes/conversations.js`

Completion criteria:

- Users cannot access another user's conversations.
- Delete and recreate edge cases do not leave stale UI state.
- Chat persistence can later store each user/assistant turn exactly once.

### Debt 7: file storage and RAG ingestion

Scope:

- Implement visible file listing, multipart upload, download, individual deletion, and scoped deletion.
- Preserve global versus user ownership rules.
- Sanitize filenames and accept only supported text files.
- Port JSON-only chunk creation and file-index persistence.
- Prevent background processing from resurrecting deleted files.

Expected boundaries:

- `src/files/storage.js`
- `src/rag/ingestion.js`
- `src/routes/files.js`

Completion criteria:

- Admin, user, and read-only behavior matches the reference.
- Upload and deletion remain safe under concurrent processing.
- Chunks and indexes contain no embeddings or `.npy` artifacts.
- Runtime data stays within configured local directories.

### Debt 8: inconsistency analysis pipeline

Scope:

- Use `buildInconsistencyPrompt` for model comparisons.
- Compare eligible RAG sources conservatively.
- Persist asynchronous results in `conflicts_index.json`.
- Prune direct records and orphaned matches when files are deleted.
- Surface `checking` and `checked` states through `/files`.

Expected boundaries:

- `src/rag/inconsistencies.js`
- Integration with ingestion, deletion, and file listing

Completion criteria:

- Only direct factual contradictions are reported.
- Missing checks can be scheduled without duplicate uncontrolled work.
- Deleting either side removes stale conflict information.

### Debt 9: RAG security integration

Scope:

- Connect the existing `src/rag-security.js` module to upload, listing, deletion, and chat context loading.
- Inject the real model catalog, model resolver, generation boundary, and exception logger.
- Persist `security_index.json` and suspicious RAG audit logs.
- Lazily assess missing records before admitting chunks into chat.

Expected boundaries:

- Existing `src/rag-security.js` remains independent from Fastify.
- Integration belongs in RAG services and thin routes.

Completion criteria:

- Medium and high findings are visible to the frontend.
- High-risk RAG text never reaches a chat prompt.
- Deletion prunes security records.
- Multilingual and parse-error behavior remains conservative and tested.

### Debt 10: LangChain provider boundary

Scope:

- Instantiate Ollama, Gemini, OpenAI, and Anthropic chat models through their LangChain packages.
- Convert internal messages to LangChain message types.
- Support both invocation and provider streaming behind one internal interface.
- Normalize model output without exposing provider-specific objects to routes.

Expected boundaries:

- `src/models/factory.js`
- `src/models/generate.js`

Completion criteria:

- Routes never call provider REST APIs directly.
- Missing packages, keys, models, and runtimes produce clear errors.
- Automated tests mock every provider and make no real external calls.

### Debt 11: chat orchestration, safety, and streaming

Scope:

- Implement `/chat` using the selected model, conversation history, user-message safety analysis, and visible safe context.
- Use `boundedContextChunks`, the canonical prompt builders, and RAG security exclusion.
- Enforce RAG response tags and remove accidental tags from general mode.
- Stream reference-compatible newline-delimited JSON.
- Persist messages and suspicious-chat audits exactly once.

Expected boundaries:

- `src/chat/orchestrator.js`
- `src/chat/stream.js`
- `src/chat/audit.js`
- `src/routes/chat.js`

Completion criteria:

- React renders incremental responses using `{ "text": string, "done": boolean }` events.
- General mode activates whenever no safe usable chunks remain.
- RAG context is explicitly untrusted and cannot override system rules.
- Streaming and non-streaming paths persist equivalent final content.
- Provider or client disconnect failures do not create duplicate messages.

### Debt 12: route decomposition and final parity validation

Scope:

- Replace the empty handlers in `src/routes/server.js` with registrations of the completed route plugins.
- Remove obsolete stubs only after their real replacements are registered.
- Port the remaining relevant Python tests into Vitest.
- Run role-based, persistence, upload, RAG security, conflict, provider, and streaming smoke tests.
- Update README and this document to describe the completed Node behavior rather than migration scaffolding.

Completion criteria:

- No endpoint handler remains an empty placeholder.
- The full Node test suite passes.
- `npm run check`, `npm test`, and `npm run build` all pass.
- No runtime path depends on Python or files inside `reference/`.
- The React application works against Fastify without compatibility shims beyond documented legacy URL aliases.

## Technical-debt handling rules

- Close one debt block at a time unless two blocks are inseparable and reviewed together.
- Do not mark a block complete because files or route signatures exist; its completion criteria must be met.
- When completing a block, add or port its tests and update the migration-state sections in README and AGENTS.
- If implementation reveals an omitted dependency, record it under the relevant block before expanding scope.
- Preserve known expected failures only while their owning debt block is still open.
- Do not hide incomplete behavior behind fake success responses, permissive authorization, or disabled tests.

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
