import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1901,
    strictPort: true,
    proxy: {
      // Preserve query string — rewrite must NOT drop ?query=…
      '/sparql/wikidata': {
        target: 'https://query.wikidata.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sparql\/wikidata/, '/sparql'),
        secure: true,
        headers: {
          'User-Agent': 'Ontara/1.0 (https://github.com/moktarul12/ontara)',
        },
      },
      '/sparql/dbpedia': {
        target: 'https://dbpedia.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sparql\/dbpedia/, '/sparql'),
        secure: true,
      },
      '/sparql/yago': {
        target: 'https://yago-knowledge.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sparql\/yago/, '/sparql/qlever'),
        secure: true,
        headers: {
          'User-Agent': 'Ontara/1.0 (https://github.com/moktarul12/ontara)',
        },
      },
      '/api/wikidata': {
        target: 'https://www.wikidata.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/wikidata/, '/w/api.php'),
        secure: true,
        headers: {
          'User-Agent': 'Ontara/1.0 (https://github.com/moktarul12/ontara)',
        },
      },
      // back-compat
      '/sparql': {
        target: 'https://dbpedia.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sparql(?=\?|$)/, '/sparql'),
        secure: true,
      },
    },
  },
})
