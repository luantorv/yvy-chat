import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import type { LCDoc } from "./engine"
import { parsePdfBuffer } from "./pdf"

const TEXT_EXTENSIONS = new Set([".md", ".txt"])

// Carga el corpus base con el que arranca el RAG (data/*.md, data/*.pdf, ...)
// para que el backend tenga conocimiento propio sin depender de que un
// cliente suba nada. Los .pdf se parsean con el mismo loader que usa el
// endpoint de upload, así que ese flujo sigue siendo utilizable igual.
export async function loadCorpusDir(dir: string): Promise<LCDoc[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const docs: LCDoc[] = []
  for (const entry of entries.sort()) {
    const filePath = path.join(dir, entry)
    const ext = path.extname(entry).toLowerCase()
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await readFile(filePath, "utf-8")
      if (text.trim().length === 0) continue
      docs.push({ pageContent: text, metadata: { source: entry } })
    } else if (ext === ".pdf") {
      const buffer = await readFile(filePath)
      const pdfDocs = await parsePdfBuffer(buffer)
      docs.push(...pdfDocs.map(doc => ({
        pageContent: doc.pageContent,
        metadata: { ...doc.metadata, source: entry },
      })))
    }
  }
  return docs
}
