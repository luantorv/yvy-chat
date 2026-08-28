import "dotenv/config"
import path from "node:path"
import express from "express"
import cors from "cors"
import multer from "multer"

import { processDocs, chat, resetChatEngine, hasChatEngine, type LCDoc } from "./engine"
import { parsePdfBuffer } from "./pdf"
import { loadCorpusDir } from "./corpus"

const app = express()
app.use(cors())
app.use(express.json({ limit: "20mb" }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

app.get("/health", (_req, res) => {
  res.json({ status: "ok", chatEngineReady: hasChatEngine() })
})

// Sube un PDF crudo (multipart/form-data, campo "file"), lo parsea en el
// server y arma el índice RAG. Equivalente a lo que antes hacía el cliente
// con WebPDFLoader + el server action `processDocs`, pero todo del lado
// del backend para que este proyecto no dependa del frontend.
app.post("/api/documents", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Falta el archivo PDF (campo 'file')" })
  }
  try {
    const lcDocs = await parsePdfBuffer(req.file.buffer)
    await processDocs(lcDocs)
    res.json({ ok: true, pages: lcDocs.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Error al procesar el PDF" })
  }
})

// Variante que acepta documentos ya parseados (mismo formato que recibía el
// server action original), por si un cliente prefiere parsear el PDF antes
// de enviarlo.
app.post("/api/documents/parsed", async (req, res) => {
  const lcDocs = req.body?.lcDocs as LCDoc[] | undefined
  if (!Array.isArray(lcDocs)) {
    return res.status(400).json({ error: "Se esperaba { lcDocs: LCDoc[] } en el body" })
  }
  try {
    await processDocs(lcDocs)
    res.json({ ok: true, pages: lcDocs.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Error al procesar los documentos" })
  }
})

app.post("/api/chat", async (req, res) => {
  const query = req.body?.query as string | undefined
  if (!query) {
    return res.status(400).json({ error: "Se esperaba { query: string } en el body" })
  }
  if (!hasChatEngine()) {
    return res.status(409).json({ error: "Todavía no se procesó ningún PDF" })
  }
  try {
    const result = await chat(query)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Error generando la respuesta" })
  }
})

app.post("/api/reset", async (_req, res) => {
  await resetChatEngine()
  res.json({ ok: true })
})

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? "data")

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`pdf-ai-backend escuchando en http://localhost:${port}`)
})

// Corpus base con el que arranca el RAG (ver DATA_DIR / backend/data). Corre
// en background para no bloquear el arranque del server: el health check
// (`chatEngineReady`) refleja cuándo terminó de indexarse.
loadCorpusDir(DATA_DIR)
  .then(async docs => {
    if (docs.length === 0) {
      console.warn(`No se encontraron documentos en ${DATA_DIR}; el RAG arranca vacío.`)
      return
    }
    console.log(`Indexando ${docs.length} documento(s) desde ${DATA_DIR}...`)
    await processDocs(docs)
    console.log("Corpus base listo.")
  })
  .catch(err => {
    console.error("Error cargando el corpus base:", err)
  })
