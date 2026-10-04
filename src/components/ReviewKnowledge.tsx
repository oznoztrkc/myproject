import { useState, type FormEvent } from 'react'
import { aiService, knowledgeRepository, setAdminToken } from '../knowledge/api'
import type { AnalysisPreview, KnowledgeItem } from '../knowledge/types'

export default function ReviewKnowledge() {
  const [title, setTitle] = useState('')
  const [rawContent, setRawContent] = useState('')
  const [previousId, setPreviousId] = useState('')
  const [token, setToken] = useState('')
  const [preview, setPreview] = useState<AnalysisPreview | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function analyze(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !rawContent.trim()) return
    setAdminToken(token)
    setBusy(true); setError(''); setMessage(''); setPreview(null)
    try {
      setPreview(await aiService.analyze(title.trim(), rawContent.trim(), previousId.trim() || undefined))
      setMessage('Analiz inceleme için hazır. Yayınlanmadan önce tüm bilgileri kontrol edin.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Analiz tamamlanamadı.') }
    finally { setBusy(false) }
  }

  async function saveOrPublish(action: 'save' | 'publish' | 'reject') {
    if (!preview) return
    setAdminToken(token)
    setBusy(true); setError(''); setMessage('')
    try {
      if (action === 'reject') {
        setPreview(await knowledgeRepository.reject(preview.document.id))
        setMessage('Taslak reddedildi ve arşivlendi.')
      } else {
        const reviewed = await knowledgeRepository.saveReview(preview.document.id, preview)
        setPreview(action === 'publish' ? await knowledgeRepository.publish(reviewed.document.id) : reviewed)
        setMessage(action === 'publish' ? 'Bilgi yayınlandı.' : 'İnceleme kaydedildi.')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.') }
    finally { setBusy(false) }
  }

  function updateItem(index: number, field: 'title' | 'content' | 'keywords' | 'categoryId' | 'sourceReference', value: string) {
    setPreview((current) => current && ({ ...current, items: current.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: field === 'keywords' ? value.split(',').map((word) => word.trim()).filter(Boolean) : value } : item,
    ) }))
  }

  function addItem() {
    setPreview((current) => {
      if (!current || !current.categories.length) return current
      const now = new Date().toISOString()
      const item: KnowledgeItem = { id: crypto.randomUUID(), documentId: current.document.id, categoryId: current.categories[0].id, title: '', content: '', keywords: [], sourceReference: '', sourceStart: 0, sourceEnd: 0, status: 'PendingReview', version: current.document.version, createdAt: now, updatedAt: now }
      return { ...current, items: [...current.items, item] }
    })
  }

  return <section className="panel" aria-labelledby="review-title">
    <span className="eyebrow">YÖNETİCİ / İNCELEME</span>
    <h1 id="review-title">Bilgi girişi</h1>
    <p className="notice">Yönetici anahtarı sadece sunucuda doğrulanır; üretim ortamında kurumsal oturum/rol yetkilendirmesi gereklidir.</p>
    <form onSubmit={analyze} className="stack">
      <label htmlFor="admin-token">Yönetici anahtarı</label>
      <input id="admin-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} required />
      <label htmlFor="doc-title">Belge başlığı</label>
      <input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <label htmlFor="previous-id">Güncellenecek belge kimliği (isteğe bağlı)</label>
      <input id="previous-id" value={previousId} onChange={(event) => setPreviousId(event.target.value)} placeholder="Yeni sürüm oluşturmak için önceki belge kimliği" />
      <label htmlFor="raw-content">Kaynak metin</label>
      <textarea id="raw-content" rows={9} value={rawContent} onChange={(event) => setRawContent(event.target.value)} required placeholder="İncelenecek metni buraya yapıştırın" />
      <button disabled={busy} type="submit">{busy ? 'İşleniyor…' : 'AI ile analiz et'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {preview && <section className="result" aria-label="Analiz önizlemesi">
      <h2>Yayın öncesi önizleme</h2>
      <p>Belge: {preview.document.title} · Sürüm {preview.document.version} · Durum: {preview.document.status}</p>
      {preview.document.status === 'PendingReview' && <div className="actions" aria-label="Yönetici onayı">
        <button type="button" disabled={busy || !preview.items.length || preview.items.some((item) => !item.title.trim() || !item.content.trim() || !item.sourceReference.trim())} onClick={() => saveOrPublish('publish')}>Onayla ve Yayınla</button>
        <button className="secondary" type="button" disabled={busy} onClick={() => saveOrPublish('save')}>İncelemeyi kaydet</button>
        <button className="secondary" type="button" disabled={busy} onClick={() => saveOrPublish('reject')}>Reddet</button>
      </div>}
      <h3>Kategoriler</h3>
      {preview.categories.map((category, index) => <div className="item" key={category.id}>
        <label htmlFor={`category-${index}`}>Kategori başlığı</label>
        <input id={`category-${index}`} value={category.title} onChange={(event) => setPreview((current) => current && ({ ...current, categories: current.categories.map((entry) => entry.id === category.id ? { ...entry, title: event.target.value } : entry) }))} />
        <label htmlFor={`description-${index}`}>Açıklama</label>
        <input id={`description-${index}`} value={category.description} onChange={(event) => setPreview((current) => current && ({ ...current, categories: current.categories.map((entry) => entry.id === category.id ? { ...entry, description: event.target.value } : entry) }))} />
      </div>)}
      <h3>Bilgi parçaları</h3>
      {preview.items.map((item, index) => <article className="item" key={item.id}>
        <label htmlFor={`item-title-${index}`}>Başlık</label>
        <input id={`item-title-${index}`} value={item.title} onChange={(event) => updateItem(index, 'title', event.target.value)} />
        <label htmlFor={`item-category-${index}`}>Kategori</label>
        <select id={`item-category-${index}`} value={item.categoryId} onChange={(event) => updateItem(index, 'categoryId', event.target.value)}>{preview.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
        <label htmlFor={`item-content-${index}`}>İçerik</label>
        <textarea id={`item-content-${index}`} rows={4} value={item.content} onChange={(event) => updateItem(index, 'content', event.target.value)} />
        <label htmlFor={`item-keywords-${index}`}>Anahtar kelimeler (virgülle ayırın)</label>
        <input id={`item-keywords-${index}`} value={item.keywords.join(', ')} onChange={(event) => updateItem(index, 'keywords', event.target.value)} />
        <label htmlFor={`item-source-${index}`}>Kaynak alıntısı (ham metinde aynen bulunmalı)</label>
        <textarea id={`item-source-${index}`} rows={3} value={item.sourceReference} onChange={(event) => updateItem(index, 'sourceReference', event.target.value)} />
        <p className="hint">Belge {item.documentId} · Sürüm {item.version}</p>
        <button type="button" className="secondary" onClick={() => setPreview((current) => current && ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}>Parçayı sil</button>
      </article>)}
      {preview.document.status === 'PendingReview' && <div className="actions">
        <button className="secondary" type="button" disabled={busy || !preview.categories.length} onClick={addItem}>Parça ekle</button>
      </div>}
    </section>}
  </section>
}
