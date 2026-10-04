import type { AnalysisPreview, RetrievalResult } from '../src/knowledge/types.ts'
import type { EmbeddingProvider, RetrievalService } from './engine.ts'
import { KeywordRetrieval } from './engine.ts'

// No unapproved text is embedded: the index is rebuilt from published records only.
export class HybridRetrieval implements RetrievalService {
  readonly embeddings: EmbeddingProvider
  readonly keywords: KeywordRetrieval
  constructor(embeddings: EmbeddingProvider, keywords = new KeywordRetrieval()) { this.embeddings = embeddings; this.keywords = keywords }
  async search(query: string, documents: AnalysisPreview[]): Promise<RetrievalResult[]> {
    const published = documents.filter((entry) => entry.document.status === 'Published')
      .flatMap((entry) => entry.items.filter((item) => item.status === 'Published'))
    if (!published.length) return []
    const texts = [query, ...published.map((item) => `${item.title} ${item.keywords.join(' ')} ${item.content} ${item.sourceReference}`.slice(0, 8000))]
    const vectors: number[][] = []
    for (let index = 0; index < texts.length; index += 50) vectors.push(...await this.embeddings.embed(texts.slice(index, index + 50)))
    if (vectors.length !== published.length + 1) throw new Error('Embedding sayısı geçersiz.')
    const keyword = await this.keywords.search(query, documents)
    const scores = new Map(keyword.map((result) => [result.item.id, result.score]))
    function cosine(a: number[], b: number[]) {
      if (!a.length || a.length !== b.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) throw new Error('Embedding boyutu geçersiz.')
      const dot = a.reduce((sum, value, index) => sum + value * b[index], 0)
      const normA = Math.hypot(...a), normB = Math.hypot(...b)
      return normA && normB ? dot / (normA * normB) : 0
    }
    const ranked = published.map((item, index) => {
      const semantic = cosine(vectors[0], vectors[index + 1])
      return { item, score: Math.max(scores.get(item.id) ?? 0, semantic) }
    }).filter((result) => result.score > 0).sort((a, b) => b.score - a.score)
    const seen = new Set<string>()
    const selected = ranked.filter(({ item }) => {
      if (seen.has(item.sourceReference)) return false
      seen.add(item.sourceReference)
      return true
    }).slice(0, 20)
    if (process.env.NODE_ENV !== 'production') console.debug('Bilgi Merkezi retrieval:', {
      query, publishedChunks: published.length, indexedChunks: vectors.length - 1,
      candidates: ranked.length, selected: selected.map(({ item, score }) => ({ id: item.id, title: item.title, score, status: item.status })),
      excluded: ranked.filter(({ item }) => !selected.some((result) => result.item.id === item.id)).slice(0, 20)
        .map(({ item, score }) => ({ id: item.id, title: item.title, score, status: item.status, reason: selected.some((result) => result.item.sourceReference === item.sourceReference) ? 'duplicate' : 'top-k' })),
    })
    return selected
  }
}
