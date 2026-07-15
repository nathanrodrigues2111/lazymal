import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves under /lazymal/; Cloudflare Pages serves at the root.
// DEPLOY_TARGET=cloudflare switches the base (and PWA scope) accordingly.
const base = process.env.DEPLOY_TARGET === 'cloudflare' ? '/' : '/lazymal/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png'],
    manifest: {
      name: 'lazymal · seasonal anime',
      short_name: 'lazymal',
      description:
        "your cozy little corner for browsing this season's anime & manga~ slick, mobile-first, and made with love.",
      theme_color: '#000000',
      background_color: '#000000',
      display: 'standalone',
      orientation: 'portrait',
      scope: base,
      start_url: base,
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