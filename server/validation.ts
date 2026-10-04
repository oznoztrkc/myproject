// Conservative source fidelity: only case, Turkish diacritics and punctuation/
// thousands formatting may differ. Every word and numeric token must remain in order.
// Unsupported spelling/grammar rewrites fail closed for manual source correction.
function canonical(text: string): string[] {
  const folded = text.toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  const tokens = folded.match(/\d[\d.,]*|[a-z]+/g) ?? []
  return tokens.map((token) => {
    if (!/^\d/.test(token)) return token
    // Only unambiguous Turkish thousands separators may be removed.
    return /^\d{1,3}(?:\.\d{3})+$/.test(token) ? token.replace(/\./g, '') : token
  })
}

export function validateMetadata(text: string, sourceReference: string): void {
  if (typeof text !== 'string') throw new Error('kaynak doğrulaması başarısız: başlık geçersiz.')
  const numbers = canonical(sourceReference).filter((token) => /^\d/.test(token))
  if (canonical(text).filter((token) => /^\d/.test(token)).some((number) => !numbers.includes(number))) {
    throw new Error('kaynak doğrulaması başarısız: başlıkta kaynak dışı sayı var.')
  }
}

export function validateSource(rawContent: string, sourceReference: string, content: string): { start: number; end: number } {
  if (typeof sourceReference !== 'string' || typeof content !== 'string' || !sourceReference.trim() || !content.trim()) throw new Error('kaynak doğrulaması başarısız.')
  const start = rawContent.indexOf(sourceReference)
  if (start < 0) throw new Error('kaynak doğrulaması başarısız: alıntı metinde yok.')
  const expected = canonical(sourceReference)
  const actual = canonical(content)
  if (!actual.length || actual.length !== expected.length || actual.some((token, index) => expected[index] !== token)) throw new Error('kaynak doğrulaması başarısız: içerik kaynakla uyuşmuyor.')
  return { start, end: start + sourceReference.length }
}
