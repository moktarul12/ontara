import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1901,
    strictPort: true,
    proxy: {
      '/sparql': {
        target: 'https://dbpedia.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sparql/, '/sparql'),
        secure: true,
      },
    },
  },
})
