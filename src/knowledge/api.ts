import type { AiService, AnalysisPreview, KnowledgeAnswer, KnowledgeRepository, RetrievalResult, RetrievalService } from './types'

let adminToken = ''
export function setAdminToken(token: string) { adminToken = token }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/knowledge${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(adminToken && path !== '/answer' && path !== '/search' ? { Authorization: `Bearer ${adminToken}` } : {}), ...init?.headers },
    })
  } catch (cause) {
    if (import.meta.env.DEV) console.error('Bilgi Merkezi bağlantı hatası:', `/api/knowledge${path}`, cause instanceof Error ? cause.message : 'İstek gönderilemedi.')
    throw new Error('Bilgi Merkezi sunucusuna ulaşılamıyor. Sunucu bağlantısını kontrol edin.')
  }
  if (!response.ok) {
    if (import.meta.env.DEV) console.error('Bilgi Merkezi HTTP hatası:', `/api/knowledge${path}`, response.status)
    if (response.status === 401 || response.status === 403) throw new Error('Bu işlem için yetkiniz yok.')
    if (response.status === 400 || response.status === 503) {
      const detail = await response.json() as { error?: string }
      throw new Error(detail.error ?? (response.status === 503 ? 'AI veya semantik arama yapılandırılmadı.' : 'Bilgi Merkezi isteği başarısız (400).'))
    }
    throw new Error(`Bilgi Merkezi isteği başarısız (${response.status}).`)
  }
  return await response.json() as T
}

export const knowledgeRepository: KnowledgeRepository = {
  getPreview: (id) => request<AnalysisPreview>(`/documents/${encodeURIComponent(id)}/preview`),
  saveReview: (id, preview) => request<AnalysisPreview>(`/documents/${encodeURIComponent(id)}/review`, {
    method: 'PUT', body: JSON.stringify(preview),
  }),
  publish: (id) => request<AnalysisPreview>(`/documents/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  reject: (id) => request<AnalysisPreview>(`/documents/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
}

export const retrievalService: RetrievalService = {
  search: (query, options) => request<RetrievalResult[]>('/search', {
    method: 'POST', body: JSON.stringify({ query, limit: options?.limit ?? 5 }),
  }),
}

export const aiService: AiService = {
  analyze: (title, rawContent, previousDocumentId) => request<AnalysisPreview>('/analyze', {
    method: 'POST', body: JSON.stringify({ title, rawContent, previousDocumentId }),
  }),
  answer: (question, conversationId) => request<KnowledgeAnswer>('/answer', {
    method: 'POST', body: JSON.stringify({ question, conversationId }),
  }),
}
