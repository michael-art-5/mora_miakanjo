import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Les fichiers de marque et les données ne font pas partie du code du site
    watch: { ignored: ['**/identite-visuelle/**', '**/storage/**'] },
    // En développement, l'API Express tourne sur le port 3001
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
})
