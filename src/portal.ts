import './portal.css'
import './navigation.css'
import './premium.css'
import './upgrade.css'
import { mountInstallButton } from './install'

type User = { id: number; role: string; firstName: string; lastName: string; email: string }
type Member = { id: number; first_name: string; last_name: string; email: string; phone: string; role: string; active: number; created_at: string; last_login: string | null; last_logout: string | null; last_duration: number; total_duration: number; total_sessions: number; last_activity: string | null; logins_today: number; live_sessions: number }
type Session = { id: number; first_name: string; last_name: string; email: string; login_at: string; logout_at: string | null; last_activity: string; duration: number }
type Content = { id: number; section: string; title: string; body: string; published: number; created_at?: string; has_image?: number }
const sections = ['Bilgi Merkezi', 'Bilgi Kartları', 'Duyurular', 'Ayın Elemanı', 'Scriptlerimiz', 'AI Bilgi Asistanı', 'İş Akışları', 'Paketler', 'Finans Kayıtları', 'Nasıl Yapılır?']
const portal = document.createElement('div')
portal.id = 'portal-root'
document.body.append(portal)
const original = Array.from(document.body.children).filter(child => child !== portal) as HTMLElement[]
const showApp = (show: boolean) => original.forEach(child => { child.hidden = !show })
showApp(false)
const safe = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[character])
const fmt = (date: string | null) => date ? new Date(date).toLocaleString('tr-TR') : '—'
const duration = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 3600)} sa ${Math.floor((Math.max(0, seconds) % 3600) / 60)} dk`
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/auth' + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'İşlem başarısız.')
  return result as T
}
let current: User | null = null
let heartbeat: number | undefined
const mic = document.querySelector<HTMLButtonElement>('#micBtn')!
const chatInputRow = document.querySelector<HTMLElement>('.input-area')!
const navigation = document.createElement('div')
navigation.id = 'portal-navigation'
document.body.append(navigation)
let page = 'Ana Sayfa'
let announcementTimer: number | undefined
const entries = [
  ['Ana Sayfa', '⌂'], ['AI Bilgi Asistanı', '✦'], ['Bilgi Merkezi', '▤'], ['Bilgi Kartları', '▦'], ['Akıllı Arama', '⌕'],
  ['Duyurular', '◉'], ['Ayın Elemanı', '★'], ['İş Akışları', '↗'], ['Paketler', '◈'], ['Nasıl Yapılır?', '?'], ['Finans Kayıtları', '₺'],
  ['Scriptlerimiz', '≡'], ['Sesli Asistan', '♫'], ['Hesabım', '○'], ['Ayarlar', '⚙'],
] as const
const adminEntries = [
  ['Admin Paneli', '♛', 'Dashboard'], ['Aktivite Kayıtları', '▤', 'Giriş / Oturum Kayıtları'],
  ['Kullanıcılar', '○', 'Kullanıcılar'], ['Bilgi Kartları Yönetimi', '▣', 'Bilgi Kartları'],
  ['Duyuru Yönetimi', '◉', 'Duyurular'], ['Ayın Elemanı Yönetimi', '★', 'Ayın Elemanı'],
  ['Bilgi Merkezi Yönetimi', '▤', 'Bilgi Merkezi'], ['Script Yönetimi', '≡', 'Scriptlerimiz'],
  ['İş Akışları Yönetimi', '↗', 'İş Akışları'], ['Paket Yönetimi', '◈', 'Paketler'], ['Nasıl Yapılır? Yönetimi', '?', 'Nasıl Yapılır?'],
  ['Finans Kayıtları Yönetimi', '₺', 'Finans Kayıtları'], ['AI İçerik Yönetimi', '✦', 'AI Bilgi Asistanı'], ['API Yönetimi', '◇', 'AI Ayarları'],
  ['Sistem Ayarları', '⚙', 'Ayarlar'],
] as const
function navButton(name: string, symbol: string) {
  return `<button type="button" data-page="${safe(name)}" class="${page === name ? 'selected' : ''}"><span aria-hidden="true">${symbol}</span>${safe(name)}</button>`
}
function drawNavigation() {
  if (!current) { navigation.replaceChildren(); return }
  navigation.innerHTML = `<div class="portal-topbar"><button type="button" class="menu-toggle" aria-controls="portal-menu" aria-expanded="false" aria-label="Menüyü aç">☰</button><strong>Digiturk <span>Bilgi Portalı</span></strong><button type="button" class="profile-link" data-page="Hesabım" aria-label="Hesabım">${safe(current.firstName)}</button></div><button type="button" class="menu-shade" aria-label="Menüyü kapat" hidden></button><nav id="portal-menu" aria-label="Ana navigasyon"><div class="menu-brand">✦ Digiturk <small>BİLGİ PORTALI</small></div><p>KEŞFET</p>${entries.map(([name, symbol]) => navButton(name, symbol)).join('')}${current.role === 'ADMIN' ? `<p>YÖNETİM</p>${adminEntries.map(([name, symbol]) => navButton(name, symbol)).join('')}` : ''}<button type="button" data-logout="true"><span aria-hidden="true">↪</span>Çıkış yap</button></nav>`
  mountInstallButton(navigation.querySelector('.portal-topbar')!)
  const menu = navigation.querySelector<HTMLElement>('#portal-menu')!
  const toggle = navigation.querySelector<HTMLButtonElement>('.menu-toggle')!
  const shade = navigation.querySelector<HTMLButtonElement>('.menu-shade')!
  const close = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Menüyü aç'); shade.hidden = true; menu.inert = window.innerWidth < 960 }
  close()
  toggle.addEventListener('click', () => { const open = menu.classList.toggle('open'); menu.inert = false; toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç'); shade.hidden = !open; if (open) menu.querySelector('button')?.focus(); else close() })
  shade.addEventListener('click', close)
  menu.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); toggle.focus() } })
  navigation.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(button => button.addEventListener('click', () => { close(); void navigate(button.dataset.page!) }))
  navigation.querySelector('[data-logout]')!.addEventListener('click', () => void logout())
}
function activate(user: User) {
  document.body.classList.add('portal-ready')
  current = user
  heartbeat = window.setInterval(() => { if (document.visibilityState === 'visible') void api('/activity', 'POST').catch(() => {}) }, 60000)
  document.addEventListener('visibilitychange', activity)
  window.addEventListener('pagehide', activity)
  const intro = document.createElement('div')
  intro.className = 'portal-intro'
  intro.setAttribute('aria-label', 'Digiturk Bilgi Portalı açılıyor')
  intro.innerHTML = '<span class="intro-mark" aria-hidden="true">✦</span><strong>Digiturk</strong><span>Bilgi Portalı</span>'
  document.body.append(intro)
  window.setTimeout(() => { intro.classList.add('leaving'); window.setTimeout(() => intro.remove(), 350) }, 1150)
  void navigate('Ana Sayfa')
}
function chatView() {
  if (mic.parentElement !== chatInputRow) chatInputRow.insertBefore(mic, chatInputRow.querySelector('.send-btn'))
  portal.hidden = true
  showApp(true)
  document.body.classList.add('chat-view')
  document.querySelector<HTMLElement>('.tabs .tab:first-child')?.click()
}
function showPortal(html: string) {
  document.body.classList.remove('chat-view')
  showApp(false)
  portal.hidden = false
  portal.innerHTML = `<main class="portal-page">${html}</main>`
}
async function navigate(name: string) {
  if (!current) return
  if (mic.parentElement !== chatInputRow) chatInputRow.insertBefore(mic, chatInputRow.querySelector('.send-btn'))
  page = name
  window.clearInterval(announcementTimer)
  drawNavigation()
  if (name === 'AI Bilgi Asistanı' || name === 'Sesli Asistan') { chatView(); if (name === 'Sesli Asistan') document.getElementById('micBtn')?.focus(); return }
  if (name === 'Hesabım') { account(); return }
  if (name === 'Ayarlar') { chatView(); document.querySelector<HTMLElement>('.tabs .tab:nth-child(2)')?.click(); return }
  const admin = adminEntries.find(([title]) => title === name)
  if (admin) { if (current.role === 'ADMIN') await panel(admin[2]); return }
  if (name === 'Ana Sayfa') { await home(); return }
  await contentPage(name)
}
const imageUrl = (item: Content) => `/api/auth/content/${item.id}/image`
function cardImage(item: Content) { return item.has_image ? `<img class="card-photo" src="${imageUrl(item)}" alt="${safe(item.title)} görseli" loading="lazy">` : '' }
function employeeCard(item: Content) { return `<article class="employee-card"><div class="employee-sparkles" aria-hidden="true">${Array.from({ length: 6 }, () => '<i></i>').join('')}</div><div class="employee-photo">${cardImage(item) || '<span class="medal" aria-hidden="true">★</span>'}</div><div class="employee-copy"><p class="eyebrow">AYIN ELEMANI</p><h3>${safe(item.title)}</h3><p>${safe(item.body)}</p></div></article>` }
function cards(items: Content[], title: string) {
  return items.length ? `<div class="content-grid">${items.map(item => `<button type="button" class="info-card" data-content="${item.id}">${cardImage(item)}<span class="card-icon" aria-hidden="true">${title === 'Scriptlerimiz' ? '≡' : '✦'}</span><small>${safe(item.section)}</small><strong>${safe(item.title)}</strong><span>${safe(item.body.slice(0, 110))}${item.body.length > 110 ? '…' : ''}</span><em>Detayı gör →</em></button>`).join('')}</div>` : '<p class="empty-note">Bu bölümde henüz yayınlanmış içerik yok.</p>'
}
function wireCards(items: Content[]) {
  portal.querySelectorAll<HTMLButtonElement>('[data-content]').forEach(button => button.addEventListener('click', () => {
    const item = items.find(entry => entry.id === Number(button.dataset.content))!
    const dialog = portal.querySelector<HTMLDialogElement>('.content-dialog')!
    dialog.innerHTML = `<div class="dialog-inner"><button type="button" class="dialog-close" aria-label="Kapat">✕</button><p class="eyebrow">${safe(item.section)}</p><h2>${safe(item.title)}</h2>${cardImage(item)}<p class="content-text">${safe(item.body)}</p><small>Yayın tarihi: ${fmt(item.created_at ?? null)}</small></div>`
    dialog.querySelector('button')!.addEventListener('click', () => dialog.close())
    dialog.showModal()
  }))
}
async function published() { return api<Content[]>('/published-content') }
async function contentPage(name: string) {
  const section = name
  showPortal(`<p class="eyebrow">BİLGİ PORTALI</p><h1>${safe(name)}</h1><div id="published-list" aria-live="polite">İçerikler yükleniyor…</div><dialog class="content-dialog" aria-label="İçerik detayı"></dialog>`)
  try {
    const items = (await published()).filter(item => name === 'Akıllı Arama' || item.section === section)
    if (page !== name) return
    const list = portal.querySelector<HTMLElement>('#published-list')!
    list.innerHTML = `${['Akıllı Arama', 'Scriptlerimiz'].includes(name) ? `<label class="search-label">İçerik ara<input id="content-search" type="search" placeholder="Başlık veya içerikte ara"></label>` : ''}<div id="filtered-list">${name === 'Ayın Elemanı' ? (items.length ? employeeCard(items[0]) : '<p class="empty-note">Bu bölümde henüz yayınlanmış içerik yok.</p>') : cards(items, name)}</div>`
    wireCards(items)
    if (name === 'Duyurular' && items.length > 1) {
      const area = list.querySelector<HTMLElement>('#filtered-list')!
      area.className = 'announcement-track'
      area.insertAdjacentHTML('afterend', '<div class="carousel-controls"><button type="button" data-scroll="-1" aria-label="Önceki duyuru">←</button><button type="button" data-scroll="1" aria-label="Sonraki duyuru">→</button></div>')
      initAnnouncementCarousel()
    }
    list.querySelector<HTMLInputElement>('#content-search')?.addEventListener('input', event => {
      const query = (event.target as HTMLInputElement).value.toLocaleLowerCase('tr-TR')
      list.querySelector<HTMLElement>('#filtered-list')!.innerHTML = cards(items.filter(item => `${item.title} ${item.body}`.toLocaleLowerCase('tr-TR').includes(query)), name)
      wireCards(items)
    })
  } catch (error) { if (page === name) portal.querySelector<HTMLElement>('#published-list')!.textContent = error instanceof Error ? error.message : 'İçerikler yüklenemedi.' }
}
function initAnnouncementCarousel() {
    const track = portal.querySelector<HTMLElement>('.announcement-track')
    if (!track) return
    const grid = track.querySelector<HTMLElement>('.content-grid')
    if (grid && grid.children.length > 1) {
      const originals = [...grid.children] as HTMLElement[]
      const count = originals.length
      originals.forEach(card => grid.append(card.cloneNode(true)))
      originals.slice().reverse().forEach(card => grid.prepend(card.cloneNode(true)))
      const step = () => (grid.children[1] as HTMLElement).offsetLeft - (grid.children[0] as HTMLElement).offsetLeft
      let index = count
      let pausedUntil = 0
      const jump = () => { grid.style.transition = 'none'; grid.style.transform = `translateX(${-index * step()}px)`; void grid.offsetHeight; grid.style.transition = '' }
      const advance = (delta: number) => {
        if (grid.classList.contains('sliding')) return
        index += delta
        grid.classList.add('sliding')
        grid.style.transform = `translateX(${-index * step()}px)`
      }
      requestAnimationFrame(jump)
      grid.addEventListener('transitionend', event => {
        if (event.target !== grid || event.propertyName !== 'transform') return
        grid.classList.remove('sliding')
        if (index >= count * 2) { index -= count; jump() }
        else if (index < count) { index += count; jump() }
      })
      let startX = 0
      let swiped = false
      track.addEventListener('pointerdown', event => { startX = event.clientX; swiped = false; pausedUntil = Date.now() + 7000 })
      track.addEventListener('pointerup', event => { const dx = event.clientX - startX; if (Math.abs(dx) > 35) { swiped = true; advance(dx < 0 ? 1 : -1) } pausedUntil = Date.now() + 7000 })
      track.addEventListener('click', event => { if (swiped) { event.preventDefault(); event.stopPropagation(); swiped = false } }, true)
      track.addEventListener('pointerenter', () => { pausedUntil = Infinity })
      track.addEventListener('pointerleave', () => { pausedUntil = Date.now() + 5000 })
      track.addEventListener('focusin', () => { pausedUntil = Infinity })
      track.addEventListener('focusout', () => { pausedUntil = Date.now() + 5000 })
      portal.querySelectorAll<HTMLButtonElement>('[data-scroll]').forEach(button => button.addEventListener('click', () => { advance(Number(button.dataset.scroll)); pausedUntil = Date.now() + 7000 }))
      grid.addEventListener('click', event => {
        const target = (event.target as Element).closest<HTMLButtonElement>('[data-content]')
        if (!target) return
        const original = originals.find(card => card.dataset.content === target.dataset.content)
        if (original && original !== target) original.click()
      })
      window.addEventListener('resize', () => { if (grid.isConnected) jump() }, { passive: true })
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) announcementTimer = window.setInterval(() => { if (grid.isConnected && document.visibilityState === 'visible' && Date.now() > pausedUntil) advance(1) }, 5000)
    }

}
async function home() {
  showPortal(`<section class="home-section" id="home-announcements" aria-live="polite"><div class="section-heading"><h2>Duyurular</h2><button type="button" data-section="Duyurular">Tümünü gör →</button></div><p class="empty-note">Duyurular yükleniyor…</p></section><section class="welcome"><p class="eyebrow">DİGİTURK BİLGİ PORTALI</p><h1>Merhaba, ${safe(current?.firstName)}</h1><p>Aradığın bilgiye hızlıca ulaş.</p><form id="home-search"><label for="home-question">Ne merak ediyorsun?</label><div class="home-search-row"><input id="home-question" type="search" placeholder="Ne merak ediyorsun?" required><span id="home-mic"></span><button class="primary" aria-label="Soruyu gönder" type="submit">➤</button></div></form></section><div id="home-content" aria-live="polite">İçerikler yükleniyor…</div><dialog class="content-dialog" aria-label="İçerik detayı"></dialog>`)
  portal.querySelector('#home-mic')!.append(mic)
  const ask = (question: string) => { void navigate('AI Bilgi Asistanı').then(() => { const input = document.querySelector<HTMLInputElement>('#userInput')!; input.value = question; document.querySelector<HTMLButtonElement>('.send-btn')?.click() }) }
  portal.querySelector<HTMLFormElement>('#home-search')!.addEventListener('submit', event => { event.preventDefault(); ask(portal.querySelector<HTMLInputElement>('#home-question')!.value) })
  try {
    const items = await published()
    if (page !== 'Ana Sayfa') return
    const announcements = items.filter(item => item.section === 'Duyurular')
    const employee = items.find(item => item.section === 'Ayın Elemanı')
    portal.querySelector<HTMLElement>('#home-announcements')!.insertAdjacentHTML('beforeend', `<div class="announcement-track">${cards(announcements, 'Duyurular')}</div>${announcements.length > 1 ? '<div class="carousel-controls"><button type="button" data-scroll="-1" aria-label="Önceki duyuru">←</button><button type="button" data-scroll="1" aria-label="Sonraki duyuru">→</button></div>' : ''}`)
    portal.querySelector('#home-announcements > .empty-note')?.remove()
    portal.querySelector<HTMLElement>('#home-content')!.innerHTML = `<section class="home-section"><div class="section-heading"><h2>Ayın Elemanı</h2><button type="button" data-section="Ayın Elemanı">Tümünü gör →</button></div>${employee ? employeeCard(employee) : '<p class="empty-note">Henüz yayınlanmış içerik yok.</p>'}</section>${['Bilgi Kartları', 'Paketler', 'İş Akışları', 'Scriptlerimiz', 'Bilgi Merkezi', 'Nasıl Yapılır?', 'Finans Kayıtları'].map(section => `<section class="home-section"><div class="section-heading"><h2>${section}</h2><button type="button" data-section="${section}">Tümünü gör →</button></div>${cards(items.filter(item => item.section === section).slice(0, 4), section)}</section>`).join('')}`
    wireCards(items)
    portal.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(button => button.addEventListener('click', () => void navigate(button.dataset.section!)))
    initAnnouncementCarousel()
  } catch (error) { if (page === 'Ana Sayfa') { const message = error instanceof Error ? error.message : 'İçerikler yüklenemedi.'; portal.querySelector<HTMLElement>('#home-content')!.textContent = message; portal.querySelector<HTMLElement>('#home-announcements .empty-note')!.textContent = message } }
}
function activity() { if (current) { if (document.visibilityState === 'hidden') navigator.sendBeacon('/api/auth/activity', new Blob(['{}'], { type: 'application/json' })); else void api('/activity', 'POST').catch(() => {}) } }
async function logout() {
  try { await api('/logout', 'POST') } catch (error) { alert(error instanceof Error ? error.message : 'Çıkış yapılamadı.'); return }
  current = null
  clearInterval(heartbeat)
  document.removeEventListener('visibilitychange', activity)
  window.removeEventListener('pagehide', activity)
  window.clearInterval(announcementTimer)
  if (mic.parentElement !== chatInputRow) chatInputRow.insertBefore(mic, chatInputRow.querySelector('.send-btn'))
  navigation.replaceChildren()
  document.body.classList.remove('chat-view')
  page = ''
  showApp(false)
  portal.hidden = false
  loginView()
}
function loginView(register = false) {
  portal.hidden = false
  portal.innerHTML = `<main class="auth-wrap"><section class="auth-card"><div class="auth-mark">✦</div><p class="eyebrow">DIGITURK · BİLGİ PORTALI</p><h1>Hoş geldiniz</h1><p class="muted">Kurumsal hesabınızla bilgi merkezine erişin.</p><div class="auth-tabs"><button type="button" class="${register ? '' : 'selected'}" id="login-tab">Giriş yap</button><button type="button" class="${register ? 'selected' : ''}" id="register-tab">Kayıt ol</button></div><form id="auth-form"><div class="fields">${register ? `<label>Ad<input name="firstName" autocomplete="given-name" required></label><label>Soyad<input name="lastName" autocomplete="family-name" required></label>` : ''}<label class="wide">Şirket e-posta adresi<input type="email" name="email" autocomplete="email" placeholder="ad@concentrix.com" required></label>${register ? `<label class="wide">Telefon<input type="tel" name="phone" autocomplete="tel" required></label>` : ''}<label class="wide">Şifre<input type="password" name="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="${register ? '10' : '1'}" required></label>${register ? `<label class="wide">Şifre tekrar<input type="password" name="confirmPassword" autocomplete="new-password" required></label>` : ''}</div><p role="alert" class="portal-error" id="auth-error"></p><button class="primary" type="submit">${register ? 'Hesap oluştur' : 'Giriş yap'}</button></form><p class="auth-foot">Yalnızca @concentrix.com kurumsal e-posta adresleri</p></section></main>`
  portal.querySelector('#login-tab')!.addEventListener('click', () => loginView(false))
  portal.querySelector('#register-tab')!.addEventListener('click', () => loginView(true))
  const form = portal.querySelector<HTMLFormElement>('#auth-form')!
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const values = Object.fromEntries(Array.from(form.querySelectorAll<HTMLInputElement>('input')).map(input => [input.name, input.value]))
    const error = portal.querySelector<HTMLElement>('#auth-error')!
    if (!/^[^@\s]+@concentrix\.com$/i.test(String(values.email).trim())) { error.textContent = 'Yalnızca @concentrix.com kurumsal e-posta adresleriyle kayıt ve giriş yapılabilir.'; return }
    if (register && values.password !== values.confirmPassword) { error.textContent = 'Şifreler eşleşmiyor.'; return }
    const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!
    button.disabled = true
    try { const result = await api<{ user: User }>(register ? '/register' : '/login', 'POST', values); activate(result.user) }
    catch (reason) { error.textContent = reason instanceof Error ? reason.message : 'Bağlantı hatası.'; button.disabled = false }
  })
}
async function account() {
  showPortal(`<p class="eyebrow">PROFİL</p><h1>Hesabım</h1><section class="tile" id="account-info">Hesap bilgileri yükleniyor…</section><button type="button" id="account-exit">Çıkış yap</button>`)
  portal.querySelector('#account-exit')!.addEventListener('click', () => void logout())
  try {
    const details = await api<{ first_name: string; last_name: string; email: string; phone: string; role: string; active: number }>('/account')
    if (page !== 'Hesabım') return
    portal.querySelector<HTMLElement>('#account-info')!.innerHTML = `<dl class="account-list"><div><dt>Ad</dt><dd>${safe(details.first_name)}</dd></div><div><dt>Soyad</dt><dd>${safe(details.last_name)}</dd></div><div><dt>E-posta</dt><dd>${safe(details.email)}</dd></div><div><dt>Telefon</dt><dd>${safe(details.phone)}</dd></div><div><dt>Hesap</dt><dd>${details.active ? 'Aktif' : 'Pasif'} · ${safe(details.role)}</dd></div></dl>`
  } catch (error) { if (page === 'Hesabım') portal.querySelector<HTMLElement>('#account-info')!.textContent = error instanceof Error ? error.message : 'Hesap bilgileri yüklenemedi.' }
}
function back() { void navigate('Ana Sayfa') }
async function panel(tab: string) {
  if (current?.role !== 'ADMIN') return
  document.body.classList.remove('chat-view')
  showApp(false)
  portal.hidden = false
  portal.innerHTML = `<div class="panel"><aside class="sidebar"><div class="brand">✦ Digiturk <small>YÖNETİM PANELİ</small></div><nav aria-label="Yönetim bölümleri">${['Dashboard', 'Kullanıcılar', 'Giriş / Oturum Kayıtları', ...sections, 'AI Ayarları', 'Ayarlar'].map(name => `<button type="button" data-tab="${safe(name)}" class="${name === tab ? 'selected' : ''}">${safe(name)}</button>`).join('')}<button type="button" id="panel-back">Portala dön</button><button type="button" id="panel-exit">Çıkış</button></nav></aside><main class="panel-main"><header class="panel-head"><div><p class="eyebrow">YÖNETİM ALANI</p><h1>${safe(tab)}</h1></div><span>${safe(current.firstName)} ${safe(current.lastName)}</span></header><p class="portal-error" role="alert" id="panel-error"></p><div id="panel-body" aria-live="polite">Yükleniyor…</div></main></div>`
  portal.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.addEventListener('click', () => void panel(button.dataset.tab!)))
  portal.querySelector('#panel-back')!.addEventListener('click', back)
  portal.querySelector('#panel-exit')!.addEventListener('click', () => void logout())
  const body = portal.querySelector<HTMLElement>('#panel-body')!
  const fail = (error: unknown) => { portal.querySelector<HTMLElement>('#panel-error')!.textContent = error instanceof Error ? error.message : 'İşlem başarısız.' }
  try {
    if (tab === 'Dashboard') {
      const data = await api<{ stats: { active: number; users_today: number; sessions_today: number; duration_today: number }; recent: { first_name: string; last_name: string; email: string; login_at: string; last_activity: string }[] }>('/dashboard')
      body.innerHTML = `<div class="stats">${[['Aktif kullanıcı', data.stats.active], ['Bugün giriş yapan', data.stats.users_today], ['Bugünkü oturum', data.stats.sessions_today], ['Bugünkü kullanım', duration(data.stats.duration_today)]].map(([label, value]) => `<article class="tile"><span>${safe(label)}</span><strong>${safe(value)}</strong></article>`).join('')}</div><section class="tile"><h2>Son giriş yapanlar</h2>${data.recent.length ? data.recent.map(item => `<div class="row"><span>${safe(item.first_name)} ${safe(item.last_name)}<small>${safe(item.email)}</small></span><span>Giriş: ${fmt(item.login_at)}<small>Son aktivite: ${fmt(item.last_activity)}</small></span></div>`).join('') : '<p>Henüz kayıt yok.</p>'}</section>`
    } else if (tab === 'Kullanıcılar') {
      const users = await api<Member[]>('/users')
      body.innerHTML = users.length ? `<div class="card-grid">${users.map(u => `<article class="tile"><h2>${safe(u.first_name)} ${safe(u.last_name)}</h2><p>${safe(u.email)} · ${safe(u.phone)}</p><p>${safe(u.role)} · ${u.active ? 'Aktif' : 'Pasif'}</p><small>Kayıt: ${fmt(u.created_at)}<br>Son giriş: ${fmt(u.last_login)}<br>Son çıkış: ${fmt(u.last_logout)}<br>Son oturum: ${duration(u.last_duration)}<br>Toplam süre: ${duration(u.total_duration)}<br>Toplam oturum sayısı: ${u.total_sessions}<br>Bugün giriş yaptı mı?: ${u.logins_today ? 'Evet' : 'Hayır'}<br>Son aktivite: ${fmt(u.last_activity)}<br>Oturum durumu: ${u.live_sessions ? 'Çevrimiçi' : 'Çevrimdışı'}<br>Soru sayısı: Henüz izlenmiyor</small><div class="actions"><button data-user="${u.id}" data-active="${u.active ? 'false' : 'true'}">${u.active ? 'Pasife al' : 'Aktifleştir'}</button><button data-delete="${u.id}">Sil</button></div></article>`).join('')}</div>` : '<p>Henüz kullanıcı yok.</p>'
      body.querySelectorAll<HTMLButtonElement>('[data-user]').forEach(button => button.addEventListener('click', async () => { try { await api(`/users/${button.dataset.user}`, 'PATCH', { active: button.dataset.active === 'true' }); void panel(tab) } catch (e) { fail(e) } }))
      body.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Kullanıcı ve oturum kayıtları silinsin mi?')) return; try { await api(`/users/${button.dataset.delete}`, 'DELETE'); void panel(tab) } catch (e) { fail(e) } }))
    } else if (tab === 'Giriş / Oturum Kayıtları') {
      body.innerHTML = `<section class="tile"><label>Tarih filtresi<select id="range"><option value="today">Bugün</option><option value="yesterday">Dün</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="custom">Özel tarih aralığı</option></select></label><div class="fields"><label>Başlangıç<input type="date" id="from"></label><label>Bitiş<input type="date" id="to"></label></div><button id="filter">Filtrele</button></section><div id="session-list"></div>`
      const range = body.querySelector<HTMLSelectElement>('#range')!
      const start = body.querySelector<HTMLInputElement>('#from')!, end = body.querySelector<HTMLInputElement>('#to')!
      const filter = async () => {
        const date = new Date(), iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        let from = start.value, to = end.value
        if (range.value !== 'custom') { to = iso(date); date.setDate(date.getDate() - (range.value === 'yesterday' ? 1 : range.value === 'today' ? 0 : Number(range.value) - 1)); from = iso(date); if (range.value === 'yesterday') to = from }
        try { const sessions = await api<Session[]>(`/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`); body.querySelector<HTMLElement>('#session-list')!.innerHTML = sessions.length ? `<div class="card-grid">${sessions.map(s => `<article class="tile"><h2>${safe(s.first_name)} ${safe(s.last_name)}</h2><p>${safe(s.email)}</p><small>Giriş: ${fmt(s.login_at)}<br>Çıkış: ${fmt(s.logout_at)}<br>Son aktivite: ${fmt(s.last_activity)}<br>Süre: ${duration(s.duration)}<br>Durum: ${s.logout_at ? 'Kapalı' : 'Açık'}</small></article>`).join('')}</div>` : '<p>Bu aralıkta kayıt yok.</p>' } catch (e) { fail(e) }
      }
      body.querySelector('#filter')!.addEventListener('click', () => void filter())
      void filter()
    } else if (tab === 'AI Ayarları') {
      const settings = await api<{ configured: boolean }>('/ai-settings')
      body.innerHTML = `<section class="tile"><h2>OpenAI API ayarı</h2><p>${settings.configured ? 'Anahtar sunucuda tanımlı.' : 'Anahtar henüz tanımlanmadı.'}</p><form id="ai-settings-form"><label>OpenAI API KEY<input type="password" name="key" autocomplete="off" required placeholder="sk-…"></label><button type="submit" class="primary">Kaydet</button></form></section>`
      body.querySelector<HTMLFormElement>('#ai-settings-form')!.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const key = (form.elements.namedItem('key') as HTMLInputElement).value; try { await api('/ai-settings', 'POST', { key }); form.reset(); void panel(tab) } catch (e) { fail(e) } })
    } else if (sections.includes(tab)) {
      const items = (await api<Content[]>('/content')).filter(item => item.section === tab)
      body.innerHTML = `<section class="tile"><h2>İçerik ekle / düzenle</h2><form id="content-form"><input type="hidden" name="id"><label>Başlık<input name="title" required></label><label>İçerik<textarea name="body" rows="5" required></textarea></label><label>Fotoğraf (JPEG, PNG veya WebP; en fazla 8 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><img id="photo-preview" class="admin-photo" alt="Seçilen fotoğraf önizlemesi" hidden><button type="button" id="remove-photo" hidden>Fotoğrafı kaldır</button><p id="photo-status" role="status" aria-live="polite"></p><label class="check"><input name="published" type="checkbox"> Yayınla</label><button class="primary" type="submit">Kaydet</button></form></section><div class="card-grid">${items.map(item => `<article class="tile">${cardImage(item)}<h2>${safe(item.title)}</h2><p class="content-text">${safe(item.body)}</p><small>${item.published ? 'Yayında' : 'Taslak'}</small><div class="actions"><button data-edit="${item.id}">Düzenle</button><button data-remove="${item.id}">Sil</button></div></article>`).join('') || '<p>Henüz içerik yok.</p>'}</div>`
      const form = body.querySelector<HTMLFormElement>('#content-form')!
      const photo = form.elements.namedItem('photo') as HTMLInputElement
      const preview = body.querySelector<HTMLImageElement>('#photo-preview')!
      const remove = body.querySelector<HTMLButtonElement>('#remove-photo')!
      const status = body.querySelector<HTMLElement>('#photo-status')!
      let removed = false
      let previewUrl = ''
      const showPreview = (source: string) => { preview.src = source; preview.hidden = false; remove.hidden = false }
      const clearPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; preview.removeAttribute('src'); preview.hidden = true; photo.value = ''; remove.hidden = true }
      photo.addEventListener('change', () => {
        const file = photo.files?.[0]
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        previewUrl = ''
        if (!file) { preview.hidden = true; return }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { clearPreview(); status.textContent = 'JPEG, PNG veya WebP seçin; en fazla 8 MB.'; return }
        previewUrl = URL.createObjectURL(file)
        showPreview(previewUrl)
        removed = false
        status.textContent = 'Fotoğraf seçildi. Kaydet ile yükleyin.'
      })
      remove.addEventListener('click', () => { clearPreview(); removed = true; status.textContent = 'Kaydet ile fotoğraf kaldırılacak.' })
      form.addEventListener('submit', async event => {
        event.preventDefault()
        const data = new FormData(form)
        const id = data.get('id')
        const file = photo.files?.[0]
        const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!
        submit.disabled = true
        status.textContent = file ? 'Fotoğraf yükleniyor…' : 'İçerik kaydediliyor…'
        try {
          // For a new entry, keep it as draft until the image upload succeeds.
          const desiredPublished = data.has('published')
          const content = { section: tab, title: data.get('title'), body: data.get('body'), published: file ? (id ? !!items.find(item => item.id === Number(id))?.published : false) : desiredPublished }
          const result = await api<{ id?: number }>(id ? `/content/${id}` : '/content', id ? 'PATCH' : 'POST', content)
          const contentId = id ? Number(id) : result.id!
          if (!id) (form.elements.namedItem('id') as HTMLInputElement).value = String(contentId)
          if (file) {
            const response = await fetch(`/api/auth/content/${contentId}/image`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file, credentials: 'same-origin' })
            if (!response.ok) { const detail = await response.json(); throw new Error(detail.error ?? 'Fotoğraf yüklenemedi.') }
            if (desiredPublished !== content.published) await api(`/content/${contentId}`, 'PATCH', { ...content, published: desiredPublished })
          } else if (removed && id) await api(`/content/${contentId}/image`, 'DELETE')
          status.textContent = file ? 'İçerik ve fotoğraf kaydedildi.' : removed ? 'İçerik kaydedildi, fotoğraf kaldırıldı.' : 'İçerik kaydedildi.'
          window.setTimeout(() => { if (body.isConnected) void panel(tab) }, 1200)
        } catch (e) { fail(e); status.textContent = e instanceof Error ? e.message : 'Yükleme başarısız.' }
        finally { submit.disabled = false }
      })
      body.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(button => button.addEventListener('click', () => {
        const item = items.find(entry => entry.id === Number(button.dataset.edit))!
        clearPreview(); removed = false; status.textContent = ''
        ;(form.elements.namedItem('id') as HTMLInputElement).value = String(item.id)
        ;(form.elements.namedItem('title') as HTMLInputElement).value = item.title
        ;(form.elements.namedItem('body') as HTMLTextAreaElement).value = item.body
        ;(form.elements.namedItem('published') as HTMLInputElement).checked = !!item.published
        if (item.has_image) showPreview(imageUrl(item))
        form.scrollIntoView({ behavior: 'smooth' })
      }))
      body.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(button => button.addEventListener('click', async () => { if (!confirm('İçerik silinsin mi?')) return; try { await api(`/content/${button.dataset.remove}`, 'DELETE'); void panel(tab) } catch (e) { fail(e) } }))
    } else body.innerHTML = '<section class="tile"><h2>Ayarlar</h2><p>Hesap ve içerik yönetimi sol menüde yer alır.</p></section>'
  } catch (error) { body.textContent = 'Veriler yüklenemedi.'; fail(error) }
}
window.addEventListener('portal-voice-question', () => { if (current && page !== 'AI Bilgi Asistanı' && page !== 'Sesli Asistan') void navigate('AI Bilgi Asistanı') })
void api<{ user: User }>('/me').then(result => activate(result.user)).catch(() => loginView())
