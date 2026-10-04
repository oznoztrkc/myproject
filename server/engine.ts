import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import type { AnalysisPreview, KnowledgeAnswer, KnowledgeCategory, KnowledgeDocument, KnowledgeItem, RetrievalResult } from '../src/knowledge/types.ts'
import { validateMetadata, validateSource } from './validation.ts'

export interface StructuredAnalysis {
  documentTitle: string
  categories: { title: string; description: string; items: { title: string; content: string; keywords: string[]; sourceReference: string }[] }[]
}
export interface AIProvider {
  analyzeDocument(title: string, rawContent: string): Promise<StructuredAnalysis>
  generateAnswer(question: string, evidence: KnowledgeItem[]): Promise<string>
  resolveQuestion(question: string, previousQuestions: string[]): Promise<string>
}
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}
export interface KnowledgeStore {
  load(): Promise<AnalysisPreview[]>
  save(data: AnalysisPreview[]): Promise<void>
}
export interface RetrievalService {
  search(query: string, documents: AnalysisPreview[]): Promise<RetrievalResult[]> | RetrievalResult[]
}
const missing = 'Bilgi Merkezi kayıtlarında bu konuda yeterli bilgi bulunamadı.'
const normalize = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFC')
const tokens = (value: string) => normalize(value).match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2 || word === 'tl') ?? []
const answerWords = (value: string) => normalize(value).replace(/\b\d{1,3}(?:\.\d{3})+\b/gu, (number) => number.replace(/\./g, '')).match(/[\p{L}\p{N}]+/gu)?.map(answerToken) ?? []
// Accept inflected forms of the same verb, but keep negation part of its identity.
const answerToken = (word: string) => {
  // "yeni adresimde" and "yeni adreste" refer to the same location here.
  if (word === 'adresimde') return 'adreste'
  const negative = word.match(/^(.*?)(?:maması|memesi|muyorsa|müyorsa|mıyorsa|miyorsa|mamaktadır|memektedir)$/u)
  if (negative && negative[1].length >= 4) return `${negative[1]}:negative`
  const positive = word.match(/^(.*?)(?:maktadır|mektedir|ur|ür|ır|ir)$/u)
  return positive && positive[1].length >= 4 ? `${positive[1]}:positive` : word
}

export class FileKnowledgeStore implements KnowledgeStore {
  readonly file: string
  constructor(file: string) { this.file = file }
  async load(): Promise<AnalysisPreview[]> {
    try { return JSON.parse(await readFile(this.file, 'utf8')) as AnalysisPreview[] }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  }
  async save(data: AnalysisPreview[]): Promise<void> {
    await mkdir(this.file.substring(0, this.file.lastIndexOf('/')), { recursive: true })
    const temporary = `${this.file}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 })
    await rename(temporary, this.file)
  }
}

export class KeywordRetrieval implements RetrievalService {
  search(query: string, documents: AnalysisPreview[]): RetrievalResult[] {
    const words = [...new Set(tokens(query).map((word) => word === 'interneti' ? 'internet' : /^taşırken$/u.test(word) ? 'nakil' : word))]
    if (!words.length) return []
    const feeQuestion = words.some((word) => /^(ücret|ücreti|ücretini|parası|para|bedel|tl)$/u.test(word))
    return documents.filter((entry) => entry.document.status === 'Published').flatMap((entry) =>
      entry.items.filter((item) => item.status === 'Published').map((item) => {
        const title = tokens(item.title)
        const content = tokens(`${item.content} ${item.sourceReference}`)
        const keywords = tokens(item.keywords.join(' '))
        const fee = feeQuestion && words.some((word) => !/^(ücret|ücreti|ücretini|parası|para|bedel|tl)$/u.test(word) && (title.includes(word) || content.includes(word)))
          && [...title, ...content].some((word) => /^(ücret|ücreti|bedel|tl)$/u.test(word))
        return { item, score: (words.reduce((score, word) => score + (title.includes(word) ? 3 : content.includes(word) ? 2 : keywords.includes(word) ? 1 : 0), 0) + (fee ? 3 : 0)) / words.length }
      }),
    ).filter((result) => result.score > 0).sort((a, b) => b.score - a.score).slice(0, 20)
  }
}

export class KnowledgeService {
  private queue: Promise<unknown> = Promise.resolve()
  private conversations = new Map<string, { questions: string[]; updatedAt: number }>()
  readonly store: KnowledgeStore
  readonly ai: AIProvider
  readonly retrieval: RetrievalService
  constructor(store: KnowledgeStore, ai: AIProvider, retrieval: RetrievalService) {
    this.store = store; this.ai = ai; this.retrieval = retrieval
  }
  private update<T>(operation: (entries: AnalysisPreview[]) => Promise<T> | T): Promise<T> {
    const pending = this.queue.then(async () => operation(await this.store.load()))
    this.queue = pending.catch(() => undefined)
    return pending
  }
  private find(entries: AnalysisPreview[], id: string): AnalysisPreview {
    const entry = entries.find((value) => value.document.id === id)
    if (!entry) throw new Error('Belge bulunamadı.')
    return entry
  }
  async analyze(title: string, rawContent: string, previousDocumentId?: string): Promise<AnalysisPreview> {
    if (!title.trim() || !rawContent.trim()) throw new Error('Başlık ve metin gerekli.')
    // Create a durable Draft first; failed analysis leaves it unpublished for audit.
    const draft = await this.update(async (entries) => {
      const previous = previousDocumentId ? this.find(entries, previousDocumentId) : undefined
      if (previous && previous.document.status !== 'Published') throw new Error('Yalnızca yayınlanmış belge güncellenebilir.')
      if (previous && entries.some((entry) => entry.document.previousDocumentId === previousDocumentId && entry.document.status === 'Published')) throw new Error('Bu belgenin yeni sürümü zaten yayınlanmış.')
      const now = new Date().toISOString()
      const document: KnowledgeDocument = { id: randomUUID(), title, rawContent, status: 'Draft', version: previous ? previous.document.version + 1 : 1, createdAt: now, updatedAt: now, previousDocumentId }
      entries.push({ document, categories: [], items: [] })
      await this.store.save(entries)
      return document
    })
    const structured = await this.ai.analyzeDocument(title, rawContent)
    if (!structured || !Array.isArray(structured.categories) || !structured.categories.length) throw new Error('Analizden doğrulanabilir bilgi çıkmadı.')
    return this.update(async (entries) => {
      const entry = this.find(entries, draft.id)
      if (entry.document.status !== 'Draft') throw new Error('Taslak durumu değişti.')
      const document = entry.document
      const version = document.version
      const now = new Date().toISOString()
      const categories: KnowledgeCategory[] = []
      const items: KnowledgeItem[] = []
      for (const group of structured.categories) {
        if (!group.title?.trim() || !Array.isArray(group.items)) throw new Error('Geçersiz kategori.')
        validateMetadata(group.title, rawContent)
        const category: KnowledgeCategory = { id: randomUUID(), documentId: document.id, title: group.title, description: group.description ?? '' }
        categories.push(category)
        for (const value of group.items) {
          const location = validateSource(rawContent, value.sourceReference, value.content)
          if (!value.title?.trim()) throw new Error('Bilgi başlığı gerekli.')
          validateMetadata(value.title, value.sourceReference)
          items.push({ id: randomUUID(), documentId: document.id, categoryId: category.id, title: value.title, content: value.content.trim(), keywords: Array.isArray(value.keywords) ? value.keywords.filter((word): word is string => typeof word === 'string') : [], sourceReference: value.sourceReference, sourceStart: location.start, sourceEnd: location.end, version, status: 'PendingReview', createdAt: now, updatedAt: now })
        }
      }
      if (!items.length) throw new Error('Analizden doğrulanabilir bilgi çıkmadı.')
      // Require every nonblank source character to be linked before review.
      const covered = new Uint8Array(rawContent.length)
      for (const item of items) {
        // Identical passages may appear multiple times in pasted text.
        let start = rawContent.indexOf(item.sourceReference)
        while (start !== -1) {
          covered.fill(1, start, start + item.sourceReference.length)
          start = rawContent.indexOf(item.sourceReference, start + item.sourceReference.length)
        }
      }
      for (let index = 0; index < rawContent.length;) {
        if (covered[index] || /\s/.test(rawContent[index])) { index++; continue }
        const start = index
        while (index < rawContent.length && !covered[index]) index++
        const end = index
        const missing = rawContent.slice(start, end).trim()
        if (missing) {
          if (process.env.NODE_ENV !== 'production') console.warn('Analiz kapsamı eksik:', { start, end, excerpt: missing.slice(0, 180) })
          throw new Error('Analiz eksik: kaynak metnin tamamı bilgi parçalarına bağlanmadı.')
        }
      }
      entry.categories = categories
      entry.items = items
      document.status = 'PendingReview'
      document.updatedAt = now
      await this.store.save(entries)
      return entry
    })
  }
  async preview(id: string) { return this.find(await this.store.load(), id) }
  async review(id: string, input: AnalysisPreview): Promise<AnalysisPreview> {
    return this.update(async (entries) => {
      const entry = this.find(entries, id)
      if (entry.document.status !== 'PendingReview' || input.document.id !== id || input.document.version !== entry.document.version) throw new Error('İncelenebilir belge bulunamadı.')
      if (!Array.isArray(input.categories) || !Array.isArray(input.items) || !input.categories.length || !input.items.length) throw new Error('En az bir kategori ve parça gerekli.')
      const now = new Date().toISOString()
      const categories = input.categories.map((category) => {
        if (category.documentId !== id || !category.title?.trim()) throw new Error('Geçersiz kategori.')
        validateMetadata(category.title, entry.document.rawContent)
        return { ...category, title: category.title.trim() }
      })
      if (new Set(categories.map((c) => c.id)).size !== categories.length) throw new Error('Tekrarlanan kategori.')
      const items = input.items.map((item) => {
        if (item.documentId !== id || !categories.some((category) => category.id === item.categoryId) || !item.title?.trim() || !item.content?.trim()) throw new Error('Geçersiz bilgi parçası.')
        const existing = entry.items.find((value) => value.id === item.id)
        if (existing && existing.version !== entry.document.version) throw new Error('Geçersiz sürüm.')
        if (!existing && !item.id) throw new Error('Geçersiz yeni parça.')
        const location = validateSource(entry.document.rawContent, item.sourceReference, item.content)
        validateMetadata(item.title, item.sourceReference)
        return { ...item, sourceStart: location.start, sourceEnd: location.end, status: 'PendingReview' as const, version: entry.document.version, updatedAt: now }
      })
      if (new Set(items.map((i) => i.id)).size !== items.length) throw new Error('Tekrarlanan parça.')
      entry.categories = categories
      entry.items = items
      entry.document.updatedAt = now
      await this.store.save(entries)
      return entry
    })
  }
  async publish(id: string): Promise<AnalysisPreview> {
    return this.update(async (entries) => {
      const entry = this.find(entries, id)
      if (entry.document.status !== 'PendingReview' || !entry.items.length) throw new Error('Yayınlanabilir inceleme yok.')
      const now = new Date().toISOString()
      if (entry.document.previousDocumentId && this.find(entries, entry.document.previousDocumentId).document.status !== 'Published') throw new Error('Önceki sürüm artık yayınlı değil.')
      let previousId = entry.document.previousDocumentId
      while (previousId) {
        const previous = this.find(entries, previousId)
        previous.document.status = 'Archived'; previous.document.updatedAt = now
        previous.items.forEach((item) => { item.status = 'Archived'; item.updatedAt = now })
        previousId = previous.document.previousDocumentId
      }
      entry.document.status = 'Published'; entry.document.updatedAt = now
      entry.items.forEach((item) => { item.status = 'Published'; item.updatedAt = now })
      await this.store.save(entries)
      return entry
    })
  }
  async reject(id: string): Promise<AnalysisPreview> {
    return this.update(async (entries) => {
      const entry = this.find(entries, id)
      if (entry.document.status !== 'PendingReview') throw new Error('Reddedilebilir taslak yok.')
      entry.document.status = 'Archived'; entry.document.updatedAt = new Date().toISOString()
      entry.items.forEach((item) => { item.status = 'Archived'; item.updatedAt = entry.document.updatedAt })
      await this.store.save(entries)
      return entry
    })
  }
  async search(query: string) { return this.retrieval.search(query, await this.store.load()) }
  async answer(question: string, conversationId?: string): Promise<KnowledgeAnswer> {
    if (!question?.trim() || question.length > 2000) throw new Error('Geçerli bir soru gerekli.')
    const now = Date.now()
    for (const [id, conversation] of this.conversations) if (now - conversation.updatedAt > 30 * 60_000) this.conversations.delete(id)
    const history = conversationId && /^[a-f0-9-]{36}$/i.test(conversationId) ? this.conversations.get(conversationId)?.questions ?? [] : []
    const resolved = history.length ? await this.ai.resolveQuestion(question, history) : question
    // Context is only a search hint. It never enters the answer provider as evidence.
    const documents = await this.store.load()
    const results = await this.retrieval.search(resolved.slice(0, 2000), documents)
    let answer: KnowledgeAnswer = { text: missing, citations: [], sufficient: false, answer: missing, sources: [], confidence: 0, found: false }
    const publishedItems = new Map(documents.filter((entry) => entry.document.status === 'Published')
      .flatMap((entry) => entry.items.filter((item) => item.status === 'Published').map((item) => [item.id, item] as const)))
    // A semantic hit alone is not proof that the question concerns this record.
    const relevantIds = new Set(new KeywordRetrieval().search(resolved, documents).map((result) => result.item.id))
    const candidates = results.filter((result) => result.item.status === 'Published' && publishedItems.has(result.item.id) && relevantIds.has(result.item.id))
      .map((result) => ({ ...result, item: publishedItems.get(result.item.id)! }))
    const queryWords = tokens(resolved)
    const asksFee = queryWords.some((word) => /^(ücret|ücreti|ücretini|parası|para|bedel|tl)$/u.test(word))
    const asksDuration = queryWords.some((word) => /^(gün|günü|günde|süre|sürer)$/u.test(word))
    const selected = asksFee !== asksDuration ? candidates.filter(({ item }) => {
      const facts = tokens(item.sourceReference)
      return asksFee ? facts.some((word) => /^(ücret|ücreti|bedel|tl)$/u.test(word)) : facts.some((word) => /^(gün|günü|günde|süre|sürer)$/u.test(word))
    }) : candidates
    if (process.env.NODE_ENV !== 'production') console.debug('Bilgi Merkezi cevap seçimi:', {
      query: resolved, candidates: results.map(({ item, score }) => ({ id: item.id, title: item.title, score, status: item.status })),
      selected: selected.map(({ item }) => item.id), excluded: results.filter(({ item }) => item.status !== 'Published').map(({ item }) => item.id),
    })
    if (selected.length) {
      const evidence = selected.map((result) => result.item)
      const text = (await this.ai.generateAnswer(question, evidence)).trim()
      // Each clause must follow a published source passage in order. A percentage
      // match can conceal unsupported claims; matching loose words can reverse them.
      const clauses = text.split(/[!?;\n]+|(?<!\d)\.+|\.(?!\d)/u).map(answerWords).filter((clause) => clause.length)
      // Only the verified quote proves a claim; title and keywords are search hints.
      const quotes = evidence.map((item) => answerWords(item.sourceReference))
      const follows = (clause: string[], source: string[]) => {
        let position = 0
        for (const word of clause) {
          position = source.indexOf(word, position)
          if (position < 0) return false
          position++
        }
        return true
      }
      const usedIndices = clauses.map((clause) => quotes.findIndex((source) => follows(clause, source)))
      const used = clauses.length && usedIndices.every((index) => index >= 0)
        ? evidence.filter((_, index) => usedIndices.includes(index))
        : []
      if (used.length) {
        const sources = used.map((item) => ({ knowledgeItemId: item.id, documentId: item.documentId, version: item.version, categoryId: item.categoryId }))
        answer = { text, sufficient: true, citations: sources, answer: text, sources, confidence: results.find((result) => result.item.id === used[0].id)?.score ?? 0, found: true }
      }
      if (process.env.NODE_ENV !== 'production') console.debug('Bilgi Merkezi cevap doğrulaması:', { query: resolved, reason: used.length ? 'source-exact' : text ? 'source-mismatch' : 'empty-answer', sourceIds: used.map((item) => item.id) })
    }
    if (conversationId && /^[a-f0-9-]{36}$/i.test(conversationId)) {
      if (this.conversations.size >= 500 && !this.conversations.has(conversationId)) this.conversations.delete(this.conversations.keys().next().value!)
      this.conversations.set(conversationId, { questions: [...history.slice(-3), question], updatedAt: now })
    }
    return answer
  }
}
