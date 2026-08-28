# pdf-ai-backend

API HTTP independiente con la lógica de RAG (LlamaIndex + Ollama) que originalmente vivía como server actions de Next.js en `app/actions.ts` del proyecto `pdf-ai`. Este paquete no depende del frontend.

Al arrancar, indexa automáticamente todos los `.md`/`.txt`/`.pdf` de `data/` (configurable con `DATA_DIR`) como base de conocimiento — no requiere que ningún cliente suba nada. También se puede sumar contenido en caliente subiendo un PDF por HTTP; se agrega al corpus existente en vez de reemplazarlo.

## Requisitos

- Node.js >= 18
- [Ollama](https://ollama.com) corriendo (local o remoto)

## Setup

```bash
npm install
cp .env.example .env   # ajustar OLLAMA_HOST / OLLAMA_MODEL / PORT si hace falta
```

Descargar los modelos y crear el modelo custom (una sola vez):

```bash
ollama pull nomic-embed-text
ollama pull gemma2
ollama create argano-contract-assistant -f modelfile
```

## Correr

```bash
npm run dev     # con recarga automática
npm start       # sin recarga
```

También se puede levantar todo el stack (Ollama + init de modelos + backend + frontend) con Docker desde la raíz del proyecto:

```bash
cd ..
docker compose up
```

## Endpoints

- `GET /health` — estado del servicio; `chatEngineReady` indica si terminó de
  indexar el corpus base (o algún PDF) y ya se puede chatear.
- `POST /api/documents` — `multipart/form-data` con campo `file` (el PDF).
  Parsea el PDF en el server y lo suma al índice vectorial existente (no
  reemplaza el corpus base cargado desde `data/`). Opcional, solo para probar
  el flujo de PDF.
- `POST /api/documents/parsed` — alternativa para clientes que ya parsearon el
  PDF ellos mismos: `{ "lcDocs": [{ "pageContent": "...", "metadata": {...} }] }`.
- `POST /api/chat` — `{ "query": "..." }` → `{ response, metadata }`.
- `POST /api/reset` — reinicia el estado de chat (no borra el índice).

### Ejemplo

```bash
curl -F "file=@contrato.pdf" http://localhost:3001/api/documents

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Cuál es la duración del contrato?"}'
```

## Diferencias respecto a `app/actions.ts`

La lógica de RAG (`src/engine.ts`) es prácticamente idéntica al server action original: mismos modelos, mismo chunking, mismo `ContextChatEngine`. Lo que se agregó para que funcione como proyecto independiente:

- Un servidor Express (`src/index.ts`) que expone la misma funcionalidad como endpoints HTTP en lugar de server actions de Next.js.
- Parsing de PDF del lado del servidor (`src/pdf.ts`, usando `PDFLoader` de LangChain para Node) para no depender del `WebPDFLoader` que corría en el navegador del frontend.
