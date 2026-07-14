import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base is the repo name so assets resolve on GitHub Pages (user.github.io/lazymal).
// For a custom domain or local preview, build with `--base=/`.
export default defineConfig({
  base: '/lazymal/',
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png'],
    manifest: {
      name: 'LazyMAL · Seasonal Anime',
      short_name: 'LazyMAL',
      description: "Browse this season's anime in a slick, mobile-first UI.",
      theme_color: '#000000',
      background_color: '#000000',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/lazymal/',
      start_url: '/lazymal/',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'pwa-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      runtimeCaching: [
        {
          // Poster images — cache-first, they never change.
          urlPattern: /^https:\/\/cdn\.myanimelist\.net\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'mal-images',
            expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Our worker API + Jikan — network-first, cache as offline fallback.
          urlPattern:
            /^https:\/\/(lazymal-api\.lazyneilmedia\.workers\.dev|api\.jikan\.moe)\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'lazymal-api',
            networkTimeoutSeconds: 8,
            expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 6 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})