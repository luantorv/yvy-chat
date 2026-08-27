# pdf-ai-backend

API HTTP independiente con la lógica de RAG (LlamaIndex + Ollama) que originalmente
vivía como server actions de Next.js en `app/actions.ts` del proyecto `pdf-ai`. Este
paquete no depende del frontend: se le puede subir un PDF directamente y chatear
sobre su contenido vía HTTP.

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

También se puede levantar todo (Ollama + init de modelos + backend) con Docker:

```bash
docker compose up
```

## Endpoints

- `GET /health` — estado del servicio y si hay un índice/chat activo.
- `POST /api/documents` — `multipart/form-data` con campo `file` (el PDF).
  Parsea el PDF en el server, arma el índice vectorial y deja el chat listo.
- `POST /api/documents/parsed` — alternativa para clientes que ya parsearon el
  PDF ellos mismos: `{ "lcDocs": [{ "pageContent": "...", "metadata": {...} }] }`.
- `POST /api/chat` — `{ "query": "..." }` → `{ response, metadata }`.
- `POST /api/reset` — reinicia el motor de chat.

### Ejemplo

```bash
curl -F "file=@contrato.pdf" http://localhost:3001/api/documents

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Cuál es la duración del contrato?"}'
```

## Diferencias respecto a `app/actions.ts`

La lógica de RAG (`src/engine.ts`) es prácticamente idéntica al server action
original: mismos modelos, mismo chunking, mismo `ContextChatEngine`. Lo que se
agregó para que funcione como proyecto independiente:

- Un servidor Express (`src/index.ts`) que expone la misma funcionalidad como
  endpoints HTTP en lugar de server actions de Next.js.
- Parsing de PDF del lado del servidor (`src/pdf.ts`, usando `PDFLoader` de
  LangChain para Node) para no depender del `WebPDFLoader` que corría en el
  navegador del frontend.
