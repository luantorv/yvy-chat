# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

YvY-Chat (YVY AI) is a RAG chatbot over uploaded PDFs, paired with a static KPI dashboard (bar/line charts for humidity/temperature). It's split into two independent, separately deployed packages:

- `backend/` — Express + LlamaIndex + Ollama RAG API (TypeScript).
- `frontend/` — SvelteKit 5 SPA (static-adapter, SSR disabled) with Chart.js, styled with Bootstrap classes.

They communicate only over HTTP; there is no shared code, types, or build step between them.

## Commands

### Backend (`backend/`)
- `npm run dev` — run with `tsx watch` (auto-reload).
- `npm run start` — run once with `tsx`.
- `npm run typecheck` — `tsc --noEmit` (no build/emit script exists; this is the only compile check).
- No test suite and no linter are configured.
- Config via `.env` (copy from `backend/.env.example`): `PORT`, `OLLAMA_HOST`, `OLLAMA_MODEL`.

### Frontend (`frontend/`)
- `npm run dev` — Vite dev server.
- `npm run build` — static build via `@sveltejs/adapter-static` (SPA fallback to `index.html`).
- `npm run preview` — preview the static build.
- No test suite and no linter are configured.
- Config via `.env` (copy from `frontend/.env.example`): `VITE_API_URL` (defaults to `http://localhost:3001` if unset).

### Unified tooling at the repo root
- `docker-compose.yml` (root) — runs the full stack: `ollama`, `ollama-init` (pulls `nomic-embed-text`/`gemma2` and builds `argano-contract-assistant` from `backend/modelfile`), `backend` (port 3001), and `frontend` (port 5173, Vite dev server with `--host`). Previously `backend/docker-compose.yml` only covered backend+Ollama and there was no frontend service; use `docker compose up` from the root now.
- `flake.nix` (root) — single Nix devShell (`nix develop`) providing Node 22 for both packages. Previously only `frontend/flake.nix` existed; it's gone, use the root one.
- Both packages can still be run independently outside Docker/Nix (`npm install && npm run dev` in each dir) — there is no root-level npm script that starts both.

## Architecture

### Backend RAG pipeline (`backend/src`)
- `index.ts` — Express app and all HTTP routes. Holds no RAG logic itself, just delegates to `engine.ts`/`pdf.ts`.
  - `POST /api/documents` — multipart PDF upload (`multer`, in-memory, 20MB limit) → parsed via `pdf.ts` → indexed via `engine.processDocs`.
  - `POST /api/documents/parsed` — same indexing step but accepts pre-parsed `{ lcDocs: LCDoc[] }` JSON directly (for clients that parse PDFs themselves).
  - `POST /api/chat` — expects `{ query: string }` in the body; 409s if no PDF has been processed yet (`hasChatEngine()`).
  - `POST /api/reset` — resets the chat engine (keeps the vector index, clears chat state).
  - `GET /health` — reports `chatEngineReady`.
- `pdf.ts` — parses PDF buffers with LangChain's `PDFLoader` (Node variant of `WebPDFLoader`) into `LCDoc[]` (`{ pageContent, metadata }`).
- `engine.ts` — owns all LlamaIndex/Ollama state as **module-level singletons**, not per-request:
  - `embedModel` = Ollama `nomic-embed-text`; `llm` = Ollama model named by `OLLAMA_MODEL` (default `argano-contract-assistant`, a `gemma2`-based model defined in `modelfile` with a contract-review system prompt).
  - `chatEngine` (module-level `let`) is the single active `ContextChatEngine`. Uploading a new PDF (`processDocs`) rebuilds the `VectorStoreIndex` from scratch and replaces `chatEngine` — there is no multi-document/multi-session support; the backend serves one active document/index at a time, shared across all clients.
  - Chunking uses a `SentenceSplitter` with `splitLongSentences: true` (`CHUNK_SIZE=300`, `CHUNK_OVERLAP=20`) specifically because PDF-extracted text tends to arrive as one giant "sentence" per page that would otherwise blow past the embedding model's context window.
  - Retrieval uses `similarityTopK: 2`.

### Frontend (`frontend/src`)
- SvelteKit with `export const ssr = false` (`routes/+layout.js`) — this is a pure client-side SPA; nothing here runs server-side, `adapter-static` builds it to plain HTML/JS/CSS.
- `routes/+page.svelte` is the only page and contains everything: chat UI (posts to `${VITE_API_URL}/api/chat`) and two Chart.js dashboards (bar: humidity/temp by lot, line: 24h soil/air trend). Chart data is loaded from static CSVs in `static/data/*.csv` via a hand-rolled `parseCSV`, falling back to hardcoded sample data if the fetch fails.
- `routes/+layout.svelte` provides the Bootstrap navbar shell; global styles in `app.css`. Bootstrap/Bootstrap Icons classes are used throughout but Bootstrap itself is expected to be loaded via CDN/link in `app.html` rather than an npm dependency — check `app.html` before assuming Bootstrap JS features (e.g. navbar collapse) work without it.

### Known frontend/backend contract mismatch
`+page.svelte`'s `send()` posts `{ question: q }` to `/api/chat`, but the backend route reads `req.body?.query`. If you're touching chat send/receive code, confirm which field name is actually expected/sent before assuming it works end-to-end.
