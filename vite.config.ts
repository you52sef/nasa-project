import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Astra One - Space Mission Decision Trainer',
        short_name: 'Astra One',
        description: 'محاكي Astra One التعليمي لاتخاذ قرارات المهمات الفضائية على القمر والمريخ.',
        theme_color: '#07111f',
        background_color: '#07111f',
        display: 'standalone',
        start_url: base,
        scope: base,
        lang: 'ar',
        dir: 'rtl',
        icons: [
          { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg}'] },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
})
