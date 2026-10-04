import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import type { Plugin } from 'vite'
import { FileKnowledgeStore, KnowledgeService } from './engine.ts'
import { OpenAIAdapter, OpenAIEmbeddingAdapter } from './provider.ts'
import { HybridRetrieval } from './retrieval.ts'
import type { AnalysisPreview } from '../src/knowledge/types.ts'
import { requireAccess } from './auth.ts'

// Node-only: load local secrets before constructing providers. Never expose them to Vite's client env.
if (existsSync(resolve('.env'))) loadEnvFile(resolve('.env'))

const store = new FileKnowledgeStore(resolve('.data/knowledge.json'))
const service = () => new KnowledgeService(store, new OpenAIAdapter(process.env.OPENAI_API_KEY ?? '', process.env.AI_MODEL ?? ''),
  new HybridRetrieval(new OpenAIEmbeddingAdapter(process.env.OPENAI_API_KEY ?? '', process.env.AI_EMBEDDING_MODEL ?? '')))

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(data))
}

async function body(req: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of req) {
    text += chunk.toString()
    if (text.length > 10_000_000) throw new Error('Metin 10 MB sınırını aşıyor.')
  }
  return JSON.parse(text)
}

export function knowledgeApi(): Plugin {
  return {
    name: 'knowledge-api',
    configureServer(server) {
      server.middlewares.use('/api/knowledge', async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        const method = req.method ?? ''
        if (!requireAccess(req, res, !['/answer', '/search'].includes(path))) return
        try {
          if ((path === '/analyze' || path === '/answer' || path === '/search') && !process.env.OPENAI_API_KEY) {
            console.error('AI servisi yapılandırılmamış: OPENAI_API_KEY eksik.')
            send(res, 503, { error: 'AI servisi yapılandırılmamış.' }); return
          }
          if ((path === '/analyze' || path === '/answer') && !process.env.AI_MODEL) {
            console.error('AI servisi yapılandırılmamış: AI_MODEL eksik.')
            send(res, 503, { error: 'AI servisi yapılandırılmamış.' }); return
          }
          if ((path === '/answer' || path === '/search') && !process.env.AI_EMBEDDING_MODEL) {
            console.error('AI servisi yapılandırılmamış: AI_EMBEDDING_MODEL eksik.')
            send(res, 503, { error: 'AI servisi yapılandırılmamış.' }); return
          }
          if (method === 'POST' && path === '/analyze') {
            const data = await body(req) as { title: string; rawContent: string; previousDocumentId?: string }
            send(res, 200, await service().analyze(data.title, data.rawContent, data.previousDocumentId))
          } else if (method === 'POST' && path === '/answer') {
            const data = await body(req) as { question: string; conversationId?: string }
            send(res, 200, await service().answer(data.question, data.conversationId))
          } else if (method === 'POST' && path === '/search') {
            const data = await body(req) as { query: string }
            send(res, 200, await service().search(data.query))
          } else {
            const match = path.match(/^\/documents\/([^/]+)\/(preview|review|publish|reject)$/)
            if (!match) { next(); return }
            const id = decodeURIComponent(match[1])
            const operation = match[2]
            if (method === 'GET' && operation === 'preview') send(res, 200, await service().preview(id))
            else if (method === 'PUT' && operation === 'review') send(res, 200, await service().review(id, await body(req) as AnalysisPreview))
            else if (method === 'POST' && operation === 'publish') send(res, 200, await service().publish(id))
            else if (method === 'POST' && operation === 'reject') send(res, 200, await service().reject(id))
            else send(res, 405, { error: 'Yöntem desteklenmiyor.' })
          }
        } catch (error) {
          if (error instanceof Error && /^OpenAI (responses|embeddings) isteği başarısız/.test(error.message)) {
            console.error('OpenAI isteği başarısız; sağlayıcı durumunu ve sunucu yapılandırmasını kontrol edin.')
            send(res, 502, { error: 'AI sağlayıcısına ulaşılamadı veya istek reddedildi.' })
          } else if (error instanceof Error && /^(fetch failed|AI yanıtı tamamlanmadı|AI sağlayıcısından yanıt alınamadı|Embedding çıktısı geçersiz)/.test(error.message)) {
            console.error('AI sağlayıcısı geçerli yanıt vermedi.')
            send(res, 502, { error: 'AI sağlayıcısından geçerli yanıt alınamadı.' })
          } else {
            const message = error instanceof Error ? error.message : 'İstek başarısız.'
            console.error('Bilgi Merkezi API hatası:', /^(Analiz|AI geçerli|AI belge|kaynak doğrulaması|Geçersiz kategori|Başlık ve metin)/.test(message) ? message : 'İstek başarısız (ayrıntılar gizlendi).')
            send(res, 400, { error: message })
          }
        }
      })
    },
  }
}
