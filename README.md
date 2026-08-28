# YvY-Chat

Chatbot RAG (LlamaIndex + Ollama) con una base de conocimiento propia (`backend/data/*.md`, horticultura en Misiones) con la que arranca listo para usar, más un dashboard de KPIs (Chart.js). Separado en dos paquetes independientes:

- `backend/` — API HTTP en Express (ver `backend/README.md`).
- `frontend/` — SPA en SvelteKit.

## Levantar todo el stack

```bash
docker compose up
```

Esto levanta Ollama, descarga los modelos (`nomic-embed-text`, `gemma2`) y crea el modelo custom `argano-contract-assistant`, y arranca el backend (`localhost:3001`) y el frontend (`localhost:5173`) con recarga automática.

Al arrancar, el backend indexa automáticamente todo lo que haya en `backend/data/` (`.md`, `.txt` o `.pdf`) — no hace falta subir nada a mano. El frontend muestra "Cargando la base de conocimiento…" hasta que termina.  Para cambiar de qué sabe el bot, agregá/reemplazá archivos ahí (o apuntá `DATA_DIR` a otra carpeta). 

También se puede sumar un PDF extra en caliente desde el propio chat ("Agregar un PDF adicional (opcional)"), útil para probar ese flujo, pero no es necesario para el uso normal.

## Desarrollo local (sin Docker)

Requiere Node.js >= 18 y Ollama corriendo (local o remoto). Si usás Nix, hay un devShell en la raíz (`nix develop`) con Node 22.

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

---

## Autor

### Luis Antonio Reis Viera

*Estudiante de la Tecnicatura Superior en Ciencia de Datos e Inteligencia Articial | [Instituto Superior de Formación Docente y Técnica.](https://web.esim.edu.ar/)*

*Este proyecto fue desarrollado como parte de las materia de Machine Learning e Inteligencia Artificial I.*

### Contacto:

- **Mail**: `luantorv@gmail.com`
- **GitHub**: [luantorv](https://github.com/luantorv)