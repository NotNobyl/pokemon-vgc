/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  // Base path is configurable for deployment. Default '/' works for Netlify /
  // Cloudflare Pages / custom domains. For GitHub Pages project sites, set
  // VITE_BASE="/<repo-name>/" at build time. Trailing slash required.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname!, 'src'),
    },
  },
  // @ts-expect-error vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
