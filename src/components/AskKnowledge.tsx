import { useState, type FormEvent } from 'react'
import { aiService } from '../knowledge/api'
import { speechToTextService, textToSpeechService } from '../knowledge/speech'
import type { KnowledgeAnswer } from '../knowledge/types'

export default function AskKnowledge() {
  const [question, setQuestion] = useState('')
  const [conversationId] = useState(() => crypto.randomUUID())
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function ask(event: FormEvent) {
    event.preventDefault()
    if (!question.trim()) return
    setBusy(true)
    setAnswer(null)
    setError('')
    textToSpeechService.stop()
    try {
      const result = await aiService.answer(question.trim(), conversationId)
      // Server must verify citations against published items; the client cannot validate them.
      setAnswer(result.sufficient && result.citations.length ? result : {
        text: 'Bilgi Merkezi kayıtlarında bu konuda yeterli bilgi bulunamadı.',
        citations: [], sufficient: false, answer: 'Bilgi Merkezi kayıtlarında bu konuda yeterli bilgi bulunamadı.', sources: [], confidence: 0, found: false,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Soru yanıtlanamadı.')
    } finally { setBusy(false) }
  }

  async function listen() {
    setError('')
    try { setQuestion(await speechToTextService.listen()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Ses algılanamadı.') }
  }

  return <section className="panel ask" aria-labelledby="ask-title">
    <span className="eyebrow">BİLGİ MERKEZİ / ARAMA</span>
    <h1 id="ask-title">Ne merak ediyorsun?</h1>
    <p>Yanıtlar yalnızca onaylanmış Bilgi Merkezi kayıtlarına dayanır.</p>
    <form onSubmit={ask} className="ask-form">
      <label htmlFor="question">Sorunuz</label>
      <div className="input-row">
        <input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Örneğin: İnternet nakil ücreti ne kadar?" />
        <button type="button" className="secondary" onClick={listen} aria-label="Sesli soru sor">Mikrofon</button>
      </div>
      <button disabled={busy || !question.trim()} type="submit">{busy ? 'Aranıyor…' : 'Yanıt ara'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {answer && <section className="result" aria-live="polite" aria-label="Yanıt">
      <h2>Yanıt</h2><p>{answer.text}</p>
      {answer.citations.length > 0 && <><h3>Kaynak kayıtlar</h3><ul>{answer.citations.map((source, index) =>
        <li key={`${source.knowledgeItemId}-${index}`}>Kayıt {source.knowledgeItemId} · Belge {source.documentId} · Sürüm {source.version} · Kategori {source.categoryId}</li>
      )}</ul><button className="secondary" type="button" onClick={() => { try { textToSpeechService.speak(answer.text) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sesli yanıt kullanılamıyor.') } }}>Yanıtı dinle</button></>}
    </section>}
    {!answer && !error && !busy && <p className="hint">Henüz bir soru sorulmadı.</p>}
  </section>
}
