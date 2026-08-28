# YvY-Chat

Chatbot RAG sobre PDFs (LlamaIndex + Ollama) con un dashboard de KPIs (Chart.js), separado en dos paquetes independientes:

- `backend/` — API HTTP en Express (ver `backend/README.md`).
- `frontend/` — SPA en SvelteKit.

## Levantar todo el stack

```bash
docker compose up
```

Esto levanta Ollama, descarga los modelos (`nomic-embed-text`, `gemma2`) y crea
el modelo custom `argano-contract-assistant`, y arranca el backend
(`localhost:3001`) y el frontend (`localhost:5173`) con recarga automática.

## Desarrollo local (sin Docker)

Requiere Node.js >= 18 y Ollama corriendo (local o remoto). Si usás Nix, hay un
devShell en la raíz (`nix develop`) con Node 22.

```bash
# backend
cd backend
npm install
cp .env.example .env
npm run dev

# frontend (en otra terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```
