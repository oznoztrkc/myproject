import './install.css'

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let promptEvent: InstallPrompt | null = null
const installed = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
const ua = navigator.userAgent
const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const android = /Android/i.test(ua)
const chrome = android && /Chrome\//i.test(ua) && !/EdgA|OPR\/|SamsungBrowser|UCBrowser|YaBrowser|CriOS|; wv\)/i.test(ua)
const safari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)

const modal = document.createElement('div')
modal.id = 'portal-install-overlay'
modal.hidden = true
modal.innerHTML = `<section class="portal-install-dialog" role="dialog" aria-modal="true" aria-labelledby="portal-install-title" tabindex="-1"><button type="button" class="portal-install-close" aria-label="Kapat">✕</button><h2 id="portal-install-title">Digiturk Bilgi Portalı'nı Yükle</h2><p>Portalına ana ekranından uygulama gibi ulaş.</p><div class="portal-install-options"><button type="button" data-platform="android">🤖 ANDROID <small>Android cihazına yükle</small></button><button type="button" data-platform="ios">🍎 iPHONE / iOS <small>iPhone veya iPad'e yükle</small></button></div><div id="portal-install-info" role="status" aria-live="polite"></div></section>`
// Attach after the portal captures the legacy chat elements for visibility toggling.
queueMicrotask(() => document.body.append(modal))
const dialog = modal.querySelector<HTMLElement>('.portal-install-dialog')!
const info = modal.querySelector<HTMLElement>('#portal-install-info')!
let lastFocus: HTMLElement | null = null
const buttons = new Set<HTMLButtonElement>()
let accepted = false
function update() {
  buttons.forEach(button => { if (!button.isConnected) buttons.delete(button); else { button.hidden = installed() || accepted; button.textContent = '📲 Uygulamayı Yükle' } })
}
function close() { modal.hidden = true; info.replaceChildren(); if (lastFocus?.isConnected && !lastFocus.hidden) lastFocus.focus() }
function open(button: HTMLButtonElement) { if (installed()) return; lastFocus = button; modal.hidden = false; dialog.focus() }
function message(text: string, steps: string[], action = false) {
  info.replaceChildren()
  const description = document.createElement('p')
  description.textContent = text
  info.append(description)
  if (steps.length) {
    const list = document.createElement('ol')
    steps.forEach(step => { const item = document.createElement('li'); item.textContent = step; list.append(item) })
    info.append(list)
  }
  if (action) {
    const install = document.createElement('button')
    install.type = 'button'
    install.textContent = 'Sistem yükleme ekranını aç'
    install.addEventListener('click', async () => {
      if (!promptEvent) { showAndroid(); return }
      const selected = promptEvent
      promptEvent = null
      try {
        await selected.prompt()
        const result = await selected.userChoice
        if (result.outcome === 'accepted') { accepted = true; close(); update() }
        else showAndroid()
      } catch { showAndroid() }
    })
    info.append(install)
  }
}
function showAndroid() {
  const steps = ['Siteyi Android Chrome ile aç.', 'Chrome menüsündeki ⋮ simgesine dokun.', '“Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğine dokun.', 'Ekle veya Yükle ile onayla.']
  if (!android) message('Android kurulumunu Android telefonda tamamlayabilirsin.', steps)
  else if (!window.isSecureContext) message('Otomatik kurulum için HTTPS (veya localhost) gerekir.', steps)
  else if (!chrome) message('Bu tarayıcıda otomatik yükleme sunulmayabilir. Android Chrome ile açıp menüyü kullan.', steps)
  else if (!promptEvent) message('Chrome henüz otomatik yükleme seçeneği sunmadı. Site kurulum koşullarını karşılamıyor olabilir, zaten yüklü olabilir veya teklif daha önce reddedilmiş olabilir.', steps)
  else message('Android Chrome sistemin gerçek PWA yükleme ekranını açabilir.', steps, true)
}
function showIos() {
  message(safari ? 'Safari üzerinden ana ekrana ekle:' : 'iPhone veya iPad üzerinde Safari ile açıp şu adımları izle:', ['Safari ile siteyi aç.', 'Paylaş butonuna dokun.', '“Ana Ekrana Ekle” seçeneğini seç.', '“Ekle” butonuna dokun.'])
}
modal.querySelector<HTMLButtonElement>('.portal-install-close')!.addEventListener('click', close)
modal.addEventListener('click', event => { if (event.target === modal) close() })
modal.querySelector<HTMLButtonElement>('[data-platform="android"]')!.addEventListener('click', showAndroid)
modal.querySelector<HTMLButtonElement>('[data-platform="ios"]')!.addEventListener('click', showIos)
modal.addEventListener('keydown', event => {
  if (event.key === 'Escape') close()
  if (event.key === 'Tab') {
    const focusable = [...modal.querySelectorAll<HTMLButtonElement>('button:not([hidden])')]
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
})
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event as InstallPrompt; update() })
window.addEventListener('appinstalled', () => { promptEvent = null; accepted = true; close(); update() })
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', update)

export function mountInstallButton(container: Element) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'portal-install-trigger'
  button.addEventListener('click', () => open(button))
  container.append(button)
  buttons.add(button)
  update()
}

const chatButton = document.querySelector<HTMLButtonElement>('#installBtn')
if (chatButton) {
  chatButton.removeAttribute('style')
  chatButton.addEventListener('click', () => open(chatButton))
  buttons.add(chatButton)
  update()
}
