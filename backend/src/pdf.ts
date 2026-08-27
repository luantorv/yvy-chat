import { PDFLoader } from "langchain/document_loaders/fs/pdf"
import type { LCDoc } from "./engine"

// Mismo loader que usaba el frontend (WebPDFLoader), pero en su variante para
// Node, ya que aquí el PDF llega como buffer subido por HTTP en vez de un
// File del navegador.
export async function parsePdfBuffer(buffer: Buffer): Promise<LCDoc[]> {
  const blob = new Blob([buffer], { type: "application/pdf" })
  const loader = new PDFLoader(blob, { parsedItemSeparator: " " })
  const docs = await loader.load()
  return docs.map(doc => ({
    pageContent: doc.pageContent,
    metadata: doc.metadata,
  }))
}
