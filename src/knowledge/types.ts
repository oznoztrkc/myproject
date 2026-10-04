export type KnowledgeStatus = 'Draft' | 'PendingReview' | 'Published' | 'Archived'

export interface KnowledgeDocument {
  id: string
  title: string
  rawContent: string
  status: KnowledgeStatus
  createdAt: string
  updatedAt: string
  version: number
  previousDocumentId?: string
}

export interface KnowledgeCategory {
  id: string
  documentId: string
  title: string
  description: string
}

export interface KnowledgeItem {
  id: string
  documentId: string
  categoryId: string
  title: string
  content: string
  keywords: string[]
  sourceReference: string
  sourceStart: number
  sourceEnd: number
  version: number
  status: KnowledgeStatus
  createdAt: string
  updatedAt: string
}

export interface AnalysisPreview {
  document: KnowledgeDocument
  categories: KnowledgeCategory[]
  items: KnowledgeItem[]
}

export interface KnowledgeCitation {
  knowledgeItemId: string
  documentId: string
  version: number
  categoryId: string
}

export interface KnowledgeAnswer {
  text: string
  citations: KnowledgeCitation[]
  sufficient: boolean
  answer: string
  sources: KnowledgeCitation[]
  confidence: number
  found: boolean
}

export interface RetrievalResult {
  item: KnowledgeItem
  score: number
}

export interface KnowledgeRepository {
  getPreview(documentId: string): Promise<AnalysisPreview>
  saveReview(documentId: string, preview: AnalysisPreview): Promise<AnalysisPreview>
  publish(documentId: string): Promise<AnalysisPreview>
  reject(documentId: string): Promise<AnalysisPreview>
}

export interface RetrievalService {
  search(query: string, options?: { limit?: number }): Promise<RetrievalResult[]>
}

export interface AiService {
  analyze(title: string, rawContent: string, previousDocumentId?: string): Promise<AnalysisPreview>
  answer(question: string, conversationId?: string): Promise<KnowledgeAnswer>
}
