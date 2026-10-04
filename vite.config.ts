import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { knowledgeApi } from './server/api.ts'
import { chatApi } from './server/chat.ts'
import { authApi } from './server/auth.ts'

// https://vite.dev/config/
export default defineConfig({
  base: '/digiturk-internet-bilgi-portali/',
  plugins: [react(), authApi(), knowledgeApi(), chatApi()],
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '.data/**', '**/auth.sqlite*'] } },
})
