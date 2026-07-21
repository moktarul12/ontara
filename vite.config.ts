import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1901,
    strictPort: true,
    proxy: {
      '/sparql/wikidata': {
        target: 'https://query.wikidata.org',
        changeOrigin: true,
        rewrite: () => '/sparql',
        secure: true,
        headers: {
          'User-Agent': 'Ontara/1.0 (https://github.com/moktarul12/ontara)',
        },
      },
      '/sparql/dbpedia': {
        target: 'https://dbpedia.org',
        changeOrigin: true,
        rewrite: () => '/sparql',
        secure: true,
      },
      // back-compat
      '/sparql': {
        target: 'https://dbpedia.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sparql/, '/sparql'),
        secure: true,
      },
    },
  },
})
