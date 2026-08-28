# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

YvY-Chat (YVY AI) is a RAG chatbot preloaded with a fixed knowledge base (`backend/data/`, currently `.md` files about horticulture in Misiones), paired with a static KPI dashboard (bar/line charts for humidity/temperature). PDF upload is still supported as a secondary/optional path (append more documents on top of the base corpus), mainly to keep that flow testable. It's split into two independent, separately deployed packages:

- `backend/` — Express + LlamaIndex + Ollama RAG API (TypeScript).
- `frontend/` — SvelteKit 5 SPA (static-adapter, SSR disabled) with Chart.js, styled with Bootstrap classes.

They communicate only over HTTP; there is no shared code, types, or build step between them.

## Commands

### Backend (`backend/`)
- `npm run dev` — run with `tsx watch` (auto-reload).
- `npm run start` — run once with `tsx`.
- `npm run typecheck` — `tsc --noEmit` (no build/emit script exists; this is the only compile check).
- No test suite and no linter are configured.
- Config via `.env` (copy from `backend/.env.example`): `PORT`, `OLLAMA_HOST`, `OLLAMA_MODEL`, `DATA_DIR` (defaults to `./data` relative to cwd, i.e. `backend/data`).

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
- `index.ts` — Express app and all HTTP routes, plus the startup routine that loads the base corpus. Holds no RAG logic itself, just delegates to `engine.ts`/`pdf.ts`/`corpus.ts`.
  - On startup, `loadCorpusDir(DATA_DIR)` (default `backend/data`) reads every `.md`/`.txt`/`.pdf` in that directory and indexes it via `engine.processDocs`, **in the background** (doesn't block `app.listen`). `GET /health`'s `chatEngineReady` only flips to `true` once this finishes — the frontend polls it to know when the chat is usable.
  - `POST /api/documents` — multipart PDF upload (`multer`, in-memory, 20MB limit) → parsed via `pdf.ts` → indexed via `engine.processDocs`. This is an *additive* secondary path (see below), not how the base knowledge is loaded.
  - `POST /api/documents/parsed` — same indexing step but accepts pre-parsed `{ lcDocs: LCDoc[] }` JSON directly (for clients that parse PDFs themselves).
  - `POST /api/chat` — expects `{ query: string }` in the body; 409s if the corpus hasn't finished indexing yet (`hasChatEngine()`).
  - `POST /api/reset` — resets the chat engine (keeps the vector index, clears chat state).
  - `GET /health` — reports `chatEngineReady`.
- `corpus.ts` — `loadCorpusDir(dir)`: walks a directory, reads `.md`/`.txt` as plain text and `.pdf` via `pdf.ts`, returns `LCDoc[]`. This is what makes the RAG "usable out of the box" — swap/add files under `backend/data/` (or point `DATA_DIR` elsewhere) to change what the bot knows, no code changes needed for new `.md`/`.txt`/`.pdf` files.
- `pdf.ts` — parses PDF buffers with LangChain's `PDFLoader` (Node variant of `WebPDFLoader`) into `LCDoc[]` (`{ pageContent, metadata }`). Reused both by the corpus loader (for `.pdf` files in `DATA_DIR`) and the upload endpoint.
- `engine.ts` — owns all LlamaIndex/Ollama state as **module-level singletons**, not per-request:
  - `embedModel` = Ollama `nomic-embed-text`; `llm` = Ollama model named by `OLLAMA_MODEL` (default `argano-contract-assistant`, a `gemma2`-based model defined in `modelfile` with a contract-review system prompt).
  - `corpus` (module-level `LCDoc[]`) accumulates every batch of docs ever passed to `processDocs` — the startup load from `DATA_DIR`, then any PDFs uploaded afterward. Each call **rebuilds the whole `VectorStoreIndex` from the full accumulated `corpus`**, not just the new batch, so uploading a PDF augments the base knowledge instead of replacing it. There is still only one shared `chatEngine`/index for all clients (no per-session isolation).
  - Chunking uses a `SentenceSplitter` with `splitLongSentences: true` (`CHUNK_SIZE=300`, `CHUNK_OVERLAP=20`) specifically because PDF-extracted text tends to arrive as one giant "sentence" per page that would otherwise blow past the embedding model's context window.
  - Retrieval uses `similarityTopK: 2`.

### Frontend (`frontend/src`)
- SvelteKit with `export const ssr = false` (`routes/+layout.js`) — this is a pure client-side SPA; nothing here runs server-side, `adapter-static` builds it to plain HTML/JS/CSS.
- `routes/+page.svelte` is the only page and contains everything: the chat UI (posts `{ query }` to `/api/chat`, matching the backend's expected field name), an optional/collapsed PDF upload control (`<details>`, posts to `${VITE_API_URL}/api/documents` as `multipart/form-data`, field `file` — for testing the PDF path, not required for normal use), and two Chart.js dashboards (bar: humidity/temp by lot, line: 24h soil/air trend). The chat input is disabled and polls `GET /health` every 2s until `chatEngineReady` (`backendReady`) — this reflects the backend indexing its own `DATA_DIR` corpus on startup, not anything the user needs to trigger. Chart data is loaded from static CSVs in `static/data/*.csv` via a hand-rolled `parseCSV`, falling back to hardcoded sample data if the fetch fails.
- `routes/+layout.svelte` provides the Bootstrap navbar shell; global styles in `app.css`. Bootstrap/Bootstrap Icons classes are used throughout but Bootstrap itself is expected to be loaded via CDN/link in `app.html` rather than an npm dependency — check `app.html` before assuming Bootstrap JS features (e.g. navbar collapse) work without it.

### Ollama client version pinning gotcha
`engine.ts` sets the shared `ollama/browser` singleton's `host` before constructing any `Ollama`/`OllamaEmbedding` instances, since llamaindex's Ollama-backed LLM/embedding classes reuse that same default client internally and its `host` is otherwise only settable via constructor. In the installed `ollama` package version, `config` is `protected` in its types (though a plain mutable object at runtime), so this requires a type cast — don't "fix" it by removing the cast, and don't assume `OLLAMA_HOST` env var is read automatically by the `ollama` package (it isn't; the default host is hardcoded to `127.0.0.1:11434` unless overridden this way).
