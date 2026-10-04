export interface SpeechToTextService {
  listen(): Promise<string>
  stop(): void
}

export interface TextToSpeechService {
  speak(text: string): void
  stop(): void
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface BrowserRecognizer {
  lang: string
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognizer
  webkitSpeechRecognition?: new () => BrowserRecognizer
}

let recognizer: BrowserRecognizer | null = null

export const speechToTextService: SpeechToTextService = {
  listen() {
    const browser = window as SpeechWindow
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!Recognition) return Promise.reject(new Error('Bu tarayıcı sesli soru sormayı desteklemiyor.'))
    return new Promise((resolve, reject) => {
      recognizer?.stop()
      const instance = new Recognition()
      recognizer = instance
      instance.lang = 'tr-TR'
      instance.onresult = (event) => { recognizer = null; resolve(event.results[0][0].transcript) }
      instance.onerror = () => { recognizer = null; reject(new Error('Ses algılanamadı veya mikrofon izni verilmedi.')) }
      instance.onend = () => { if (recognizer === instance) { recognizer = null; reject(new Error('Ses kaydı tamamlandı; bir soru algılanmadı.')) } }
      try { instance.start() } catch { recognizer = null; reject(new Error('Mikrofon başlatılamadı.')) }
    })
  },
  stop() { recognizer?.stop(); recognizer = null },
}

export const textToSpeechService: TextToSpeechService = {
  speak(text) {
    if (!('speechSynthesis' in window)) throw new Error('Bu tarayıcı sesli yanıtı desteklemiyor.')
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'tr-TR'
    window.speechSynthesis.speak(utterance)
  },
  stop() { if ('speechSynthesis' in window) window.speechSynthesis.cancel() },
}
