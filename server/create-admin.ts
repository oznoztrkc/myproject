import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !/^[^@\s]+@concentrix\.com$/.test(email) || !password || password.length < 10 || !process.env.ADMIN_FIRST_NAME || !process.env.ADMIN_LAST_NAME || !process.env.ADMIN_PHONE) {
  console.error('ADMIN_EMAIL (@concentrix.com), ADMIN_PASSWORD (en az 10 karakter), ADMIN_FIRST_NAME, ADMIN_LAST_NAME ve ADMIN_PHONE gerekli.')
  process.exitCode = 1
} else if (!existsSync(resolve('.data/auth.sqlite'))) {
  console.error('Önce projeyi bir kez başlatın; veritabanı oluşturulmalı.')
  process.exitCode = 1
} else {
  const db = new DatabaseSync(resolve('.data/auth.sqlite'))
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) {
    if (email === 'ozan.ozturkci@concentrix.com') {
      db.prepare("UPDATE users SET role='ADMIN' WHERE email=?").run(email)
      console.log('Mevcut ana yönetici hesabı yetkilendirildi.')
    } else {
      console.error('Bu e-posta zaten kayıtlı; mevcut hesabın rolü bu komutla değişmez.')
      process.exitCode = 1
    }
  } else {
    const salt = randomBytes(16).toString('hex')
    db.prepare("INSERT INTO users (first_name,last_name,email,phone,password,role,created_at) VALUES (?,?,?,?,?,'ADMIN',?)")
      .run(process.env.ADMIN_FIRST_NAME!, process.env.ADMIN_LAST_NAME!, email, process.env.ADMIN_PHONE!, `${salt}:${scryptSync(password, salt, 64).toString('hex')}`, new Date().toISOString())
    console.log('Yönetici hesabı oluşturuldu.')
  }
  db.close()
}
