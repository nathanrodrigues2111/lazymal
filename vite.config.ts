import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Base is the repo name so assets resolve on GitHub Pages (user.github.io/lazymal).
// For a custom domain or local preview, build with `--base=/`.
export default defineConfig({
  base: '/lazymal/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
