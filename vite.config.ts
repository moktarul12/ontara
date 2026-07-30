import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ontaraDevProxy } from './vite.proxy.ts'

export default defineConfig({
  plugins: [react(), ontaraDevProxy()],
  server: {
    port: 1901,
    strictPort: true,
  },
})
