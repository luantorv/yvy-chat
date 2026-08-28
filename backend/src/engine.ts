import ollamaClient from "ollama/browser"
// El cliente por defecto de "ollama/browser" es el que usan internamente las
// clases Ollama/OllamaEmbedding de llamaindex, pero su `host` sólo se puede
// configurar por constructor; `config` es `protected` en sus tipos aunque en
// runtime es un objeto mutable normal, así que lo casteamos para poder
// apuntarlo al OLLAMA_HOST configurado antes de crear esas instancias.
;(ollamaClient as unknown as { config: { host: string } }).config.host =
  process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"

import { Document } from "llamaindex/Node"
import { VectorStoreIndex } from "llamaindex/indices/vectorStore/index"
import { ContextChatEngine } from "llamaindex/engines/chat/ContextChatEngine"
import { OllamaEmbedding } from "llamaindex/embeddings/OllamaEmbedding"
import { serviceContextFromDefaults } from "llamaindex/ServiceContext"
import { Ollama } from "llamaindex/llm/ollama"
import { SimpleNodeParser } from "llamaindex/nodeParsers/SimpleNodeParser"
import { SentenceSplitter } from "llamaindex/TextSplitter"

export interface LCDoc {
  pageContent: string,
  metadata: any,
}

const embedModel = new OllamaEmbedding({
  model: 'nomic-embed-text'
})

const llm = new Ollama({
  model: process.env.OLLAMA_MODEL ?? "argano-contract-assistant",
  options: {
    temperature: 0,
    num_predict: 1024,
  }
})

const CHUNK_SIZE = 300
const CHUNK_OVERLAP = 20

// SentenceSplitter no parte una "frase" que ya excede el chunkSize salvo que se
// pida explícitamente. El texto extraído de un PDF suele venir como una única
// frase gigante por página, que llegaba entera a nomic-embed-text y reventaba
// su ventana de contexto.
const nodeParser = new SimpleNodeParser({
  textSplitter: new SentenceSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    splitLongSentences: true,
  })
})

let chatEngine: ContextChatEngine | null = null;
// Corpus acumulado: el RAG arranca con la base cargada desde data/ (ver
// corpus.ts) y cualquier PDF subido después se suma a esa base en vez de
// reemplazarla, para no perder el conocimiento precargado.
let corpus: LCDoc[] = [];

export async function processDocs(lcDocs: LCDoc[]) {
  if (lcDocs.length == 0) return;
  corpus = corpus.concat(lcDocs)
  const docs = corpus.map(lcDoc => new Document({
    text: lcDoc.pageContent,
    metadata: lcDoc.metadata
  }))

  const index = await VectorStoreIndex.fromDocuments(docs, {
    serviceContext: serviceContextFromDefaults({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      nodeParser,
      embedModel, llm
    })
  })
  const retriever = index.asRetriever({
    similarityTopK: 2,
  })
  if (chatEngine) {
    chatEngine.reset()
  }
  chatEngine = new ContextChatEngine({
    retriever,
    chatModel: llm
  })
}

export async function chat(query: string) {
  if (chatEngine) {
    const queryResult = await chatEngine.chat({
      message: query
    })
    const response = queryResult.response
    const metadata = queryResult.sourceNodes?.map(node => node.node.metadata)
    return { response, metadata };
  }
}

export async function resetChatEngine() {
  if (chatEngine) chatEngine.reset();
}

export function hasChatEngine() {
  return chatEngine !== null;
}
