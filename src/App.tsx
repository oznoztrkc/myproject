import { useState } from 'react'
import AskKnowledge from './components/AskKnowledge'
import ReviewKnowledge from './components/ReviewKnowledge'
import './App.css'

function App() {
  const [page, setPage] = useState<'ask' | 'review'>('ask')

  return <>
    <header className="site-header">
      <span className="brand">Bilgi Merkezi<span className="brand-dot">.</span></span>
      <nav aria-label="Ana menü">
        <button className={page === 'ask' ? 'selected' : ''} type="button" onClick={() => setPage('ask')}>Bilgi ara</button>
        <button className={page === 'review' ? 'selected' : ''} type="button" onClick={() => setPage('review')}>Yönetici incelemesi</button>
      </nav>
    </header>
    <main>{page === 'ask' ? <AskKnowledge /> : <ReviewKnowledge />}</main>
    <footer>Bilgi motoru altyapısı · Sunucu API bağlantısı henüz yapılandırılmadı.</footer>
  </>
}

export default App
