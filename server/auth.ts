import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { saveOpenAIKey } from './secret.ts'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

mkdirSync(resolve('.data'), { recursive: true })
const db = new DatabaseSync(resolve('.data/auth.sqlite'))
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_login TEXT, last_logout TEXT);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, login_at TEXT NOT NULL, last_activity TEXT NOT NULL, logout_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, section TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`)
const columns = db.prepare('PRAGMA table_info(content)').all() as { name: string }[]
if (!columns.some(column => column.name === 'image')) db.exec('ALTER TABLE content ADD COLUMN image BLOB')
if (!columns.some(column => column.name === 'image_type')) db.exec('ALTER TABLE content ADD COLUMN image_type TEXT')
const domainError = 'Yalnızca @concentrix.com kurumsal e-posta adresleriyle kayıt ve giriş yapılabilir.'
const validEmail = (email: string) => /^[^@\s]+@concentrix\.com$/i.test(email)
const now = () => new Date().toISOString()
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const hashPassword = (password: string) => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}` }
const verify = (password: string, stored: string) => { const [salt, value] = stored.split(':'); if (!salt || !value || value.length !== 128) return false; return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(value, 'hex')) }
const send = (res: ServerResponse, status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)) }
async function read(req: IncomingMessage) {
  let text = ''
  for await (const chunk of req) { text += chunk.toString(); if (text.length > 100_000) throw new Error('İstek çok büyük.') }
  return JSON.parse(text || '{}') as Record<string, unknown>
}
type Identity = { id: number; role: string; active: number; email: string; first_name: string; last_name: string; session_id: number }
export function identity(req: IncomingMessage): Identity | undefined {
  const token = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('portal_session='))?.slice('portal_session='.length)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return
  const row = db.prepare(`SELECT u.id, u.role, u.active, u.email, u.first_name, u.last_name, s.id AS session_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.logout_at IS NULL AND julianday(s.login_at) > julianday('now','-12 hours')`).get(hashToken(token)) as Identity | undefined
  return row?.active ? row : undefined
}
export function requireAccess(req: IncomingMessage, res: ServerResponse, admin = false) {
  const user = identity(req)
  if (!user) { send(res, 401, { error: 'Giriş gerekli.' }); return false }
  if (admin && user.role !== 'ADMIN') { send(res, 403, { error: 'Yönetici yetkisi gerekli.' }); return false }
  return true
}
const sections = ['Bilgi Merkezi', 'Bilgi Kartları', 'Duyurular', 'Ayın Elemanı', 'Scriptlerimiz', 'AI Bilgi Asistanı', 'İş Akışları', 'Paketler', 'Finans Kayıtları', 'Nasıl Yapılır?']
export function publishedKnowledge(): string {
  return (db.prepare('SELECT section,title,body FROM content WHERE published=1 ORDER BY id').all() as { section: string; title: string; body: string }[])
    .map(item => `${item.section} / ${item.title}: ${item.body}`).join('\n\n').slice(0, 30000)
}
export function authApi(): Plugin {
  return { name: 'portal-auth', configureServer(server) {
    server.middlewares.use('/api/auth', async (req, res) => {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname
      try {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '') && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { send(res, 403, { error: 'Geçersiz kaynak.' }); return }
        if (path === '/ai-settings' && req.method === 'POST' && req.headers['content-type'] !== 'application/json') { send(res, 415, { error: 'Geçersiz içerik türü.' }); return }
        if (req.method === 'POST' && (path === '/register' || path === '/login')) {
          const input = await read(req)
          const email = String(input.email ?? '').trim().toLowerCase()
          if (!validEmail(email)) { send(res, 400, { error: domainError }); return }
          if (path === '/register') {
            if (email === 'ozan.ozturkci@concentrix.com') { send(res, 403, { error: 'Bu hesap yönetici kurulumu için ayrılmıştır.' }); return }
            const first = String(input.firstName ?? '').trim(), last = String(input.lastName ?? '').trim(), phone = String(input.phone ?? '').trim()
            const password = String(input.password ?? '')
            if (!first || !last || !phone || password.length < 10 || password !== input.confirmPassword) { send(res, 400, { error: 'Bilgileri doldurun; şifre en az 10 karakter olmalı ve tekrar eşleşmelidir.' }); return }
            if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) { send(res, 409, { error: 'Bu e-posta kayıtlı.' }); return }
            db.prepare('INSERT INTO users (first_name,last_name,email,phone,password,created_at) VALUES (?,?,?,?,?,?)').run(first, last, email, phone, hashPassword(password), now())
          }
          const user = db.prepare('SELECT * FROM users WHERE email=?').get(email) as { id: number; password: string; active: number; role: string; first_name: string; last_name: string } | undefined
          if (!user || !verify(String(input.password ?? ''), user.password) || !user.active) { send(res, 401, { error: 'E-posta veya şifre hatalı ya da hesap pasif.' }); return }
          const token = randomBytes(32).toString('hex'), time = now()
          db.prepare('INSERT INTO sessions (user_id,token_hash,login_at,last_activity) VALUES (?,?,?,?)').run(user.id, hashToken(token), time, time)
          db.prepare('UPDATE users SET last_login=? WHERE id=?').run(time, user.id)
          res.setHeader('Set-Cookie', `portal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${(req.socket as typeof req.socket & { encrypted?: boolean }).encrypted ? '; Secure' : ''}`)
          send(res, 200, { user: { id: user.id, role: user.role, firstName: user.first_name, lastName: user.last_name, email } }); return
        }
        const user = identity(req)
        if (!user) { send(res, 401, { error: 'Giriş gerekli.' }); return }
        if (req.method === 'GET' && path === '/me') { send(res, 200, { user: { id: user.id, role: user.role, firstName: user.first_name, lastName: user.last_name, email: user.email } }); return }
        if (req.method === 'GET' && path === '/account') { send(res, 200, db.prepare('SELECT first_name,last_name,email,phone,role,active FROM users WHERE id=?').get(user.id)); return }
        if (req.method === 'GET' && path === '/published-content') { send(res, 200, db.prepare('SELECT id,section,title,body,published,created_at,image_type IS NOT NULL AS has_image FROM content WHERE published=1 ORDER BY id DESC').all()); return }
        const imageMatch = path.match(/^\/content\/(\d+)\/image$/)
        if (imageMatch && req.method === 'GET') {
          const row = db.prepare('SELECT image,image_type,published FROM content WHERE id=?').get(Number(imageMatch[1])) as { image: Uint8Array | null; image_type: string | null; published: number } | undefined
          if (!row || (!row.published && user.role !== 'ADMIN') || !row.image || !row.image_type) { send(res, 404, { error: 'Görsel bulunamadı.' }); return }
          res.writeHead(200, { 'Content-Type': row.image_type, 'Content-Length': row.image.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
          res.end(row.image); return
        }
        if (req.method === 'POST' && path === '/activity') { db.prepare('UPDATE sessions SET last_activity=? WHERE id=?').run(now(), user.session_id); send(res, 200, { ok: true }); return }
        if (req.method === 'POST' && path === '/logout') {
          const time = now()
          db.prepare('UPDATE sessions SET logout_at=?,last_activity=? WHERE id=?').run(time, time, user.session_id)
          db.prepare('UPDATE users SET last_logout=? WHERE id=?').run(time, user.id)
          res.setHeader('Set-Cookie', `portal_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${(req.socket as typeof req.socket & { encrypted?: boolean }).encrypted ? '; Secure' : ''}`)
          send(res, 200, { ok: true }); return
        }
        if (user.role !== 'ADMIN') { send(res, 403, { error: 'Yönetici yetkisi gerekli.' }); return }
        if (path === '/ai-settings' && req.method === 'GET') { send(res, 200, { configured: !!process.env.OPENAI_API_KEY }); return }
        if (path === '/ai-settings' && req.method === 'POST') {
          const data = await read(req)
          const key = String(data.key ?? '').trim()
          if (!/^sk-[A-Za-z0-9_-]{15,}$/.test(key)) { send(res, 400, { error: 'Geçerli bir OpenAI API anahtarı girin.' }); return }
          saveOpenAIKey(key)
          send(res, 200, { configured: true }); return
        }
        if (req.method === 'GET' && path === '/users') {
          send(res, 200, db.prepare(`SELECT u.id,u.first_name,u.last_name,u.email,u.phone,u.role,u.active,u.created_at,u.last_login,u.last_logout,
          COALESCE((SELECT CAST((julianday(COALESCE(s.logout_at,s.last_activity))-julianday(s.login_at))*86400 AS INTEGER) FROM sessions s WHERE s.user_id=u.id ORDER BY s.id DESC LIMIT 1),0) AS last_duration,
          COALESCE((SELECT CAST(SUM((julianday(COALESCE(s.logout_at,s.last_activity))-julianday(s.login_at))*86400) AS INTEGER) FROM sessions s WHERE s.user_id=u.id),0) AS total_duration,
          (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id) AS total_sessions,
          (SELECT MAX(s.last_activity) FROM sessions s WHERE s.user_id=u.id) AS last_activity,
          (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND date(s.login_at)=date('now')) AS logins_today,
          (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.logout_at IS NULL AND julianday(s.last_activity)>=julianday('now','-5 minutes')) AS live_sessions
          FROM users u ORDER BY u.id DESC`).all()); return
        }
        if (req.method === 'GET' && path === '/sessions') {
          const query = new URL(req.url ?? '/', 'http://localhost').searchParams
          const from = query.get('from'), to = query.get('to')
          if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) { send(res, 400, { error: 'Geçersiz tarih.' }); return }
          send(res, 200, db.prepare(`SELECT s.id,u.first_name,u.last_name,u.email,s.login_at,s.logout_at,s.last_activity,
          MAX(0,CAST((julianday(COALESCE(s.logout_at,s.last_activity))-julianday(s.login_at))*86400 AS INTEGER)) AS duration
          FROM sessions s JOIN users u ON u.id=s.user_id WHERE (? IS NULL OR date(s.login_at)>=?) AND (? IS NULL OR date(s.login_at)<=?) ORDER BY s.id DESC LIMIT 1000`).all(from, from, to, to)); return
        }
        if (req.method === 'GET' && path === '/dashboard') {
          const recent = db.prepare('SELECT u.first_name,u.last_name,u.email,s.login_at,s.last_activity FROM sessions s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 8').all()
          const stats = db.prepare(`SELECT COUNT(DISTINCT CASE WHEN date(login_at)=date('now') THEN user_id END) AS users_today, SUM(CASE WHEN date(login_at)=date('now') THEN 1 ELSE 0 END) AS sessions_today,
          COALESCE(SUM(CASE WHEN date(login_at)=date('now') THEN MAX(0,CAST((julianday(COALESCE(logout_at,last_activity))-julianday(login_at))*86400 AS INTEGER)) ELSE 0 END),0) AS duration_today,
          COUNT(DISTINCT CASE WHEN logout_at IS NULL AND julianday(last_activity) >= julianday('now','-5 minutes') THEN user_id END) AS active FROM sessions`).get()
          send(res, 200, { stats, recent }); return
        }
        if (imageMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
          const id = Number(imageMatch[1])
          if (!db.prepare('SELECT id FROM content WHERE id=?').get(id)) { send(res, 404, { error: 'İçerik bulunamadı.' }); return }
          if (req.method === 'DELETE') { db.prepare('UPDATE content SET image=NULL,image_type=NULL WHERE id=?').run(id); send(res, 200, { ok: true }); return }
          let bytes = Buffer.alloc(0)
          for await (const chunk of req) { bytes = Buffer.concat([bytes, chunk]); if (bytes.length > 8 * 1024 * 1024) { send(res, 413, { error: 'Görsel en fazla 8 MB olabilir.' }); return } }
          const type = bytes.length >= 4 && bytes.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff])) ? 'image/jpeg' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null
          if (!type) { send(res, 400, { error: 'Yalnızca JPEG, PNG veya WebP görsel yükleyin.' }); return }
          db.prepare('UPDATE content SET image=?,image_type=? WHERE id=?').run(bytes, type, id)
          send(res, 200, { ok: true }); return
        }
        if (path === '/content' && req.method === 'GET') { send(res, 200, db.prepare('SELECT id,section,title,body,published,created_at,image_type IS NOT NULL AS has_image FROM content ORDER BY id DESC').all()); return }
        if (path === '/content' && req.method === 'POST') {
          const data = await read(req), section = String(data.section ?? ''), title = String(data.title ?? '').trim(), text = String(data.body ?? '').trim()
          if (!sections.includes(section) || !title || !text) { send(res, 400, { error: 'Bölüm, başlık ve içerik gerekli.' }); return }
          const result = db.prepare('INSERT INTO content (section,title,body,published,created_at) VALUES (?,?,?,?,?)').run(section, title, text, data.published === true ? 1 : 0, now())
          send(res, 200, { ok: true, id: Number(result.lastInsertRowid) }); return
        }
        const match = path.match(/^\/(users|content)\/(\d+)$/)
        if (match && ['PATCH', 'DELETE'].includes(req.method ?? '')) {
          const id = Number(match[2])
          if (match[1] === 'users') {
            if (id === user.id) { send(res, 400, { error: 'Kendi hesabınızı değiştiremezsiniz.' }); return }
            if (req.method === 'DELETE') { db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); db.prepare('DELETE FROM users WHERE id=?').run(id) }
            else { const data = await read(req); if (typeof data.active !== 'boolean') { send(res, 400, { error: 'Geçersiz durum.' }); return }; db.prepare('UPDATE users SET active=? WHERE id=?').run(data.active ? 1 : 0, id); if (!data.active) db.prepare('UPDATE sessions SET logout_at=last_activity WHERE user_id=? AND logout_at IS NULL').run(id) }
          } else if (req.method === 'DELETE') db.prepare('DELETE FROM content WHERE id=?').run(id)
          else { const data = await read(req); const section = String(data.section ?? ''), title = String(data.title ?? '').trim(), text = String(data.body ?? '').trim(); if (!sections.includes(section) || !title || !text) { send(res, 400, { error: 'Geçersiz içerik.' }); return }; db.prepare('UPDATE content SET section=?,title=?,body=?,published=? WHERE id=?').run(section, title, text, data.published === true ? 1 : 0, id) }
          send(res, 200, { ok: true }); return
        }
        send(res, 404, { error: 'Bulunamadı.' })
      } catch (error) { console.error('Kimlik işlemi:', error); send(res, 400, { error: 'İstek işlenemedi.' }) }
    })
  } }
}
