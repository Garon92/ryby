/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/ryby/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/ryby/',
        name: 'Ryby – rybářská hra',
        short_name: 'Ryby',
        description: 'Nahoď prut a chytej české ryby — čtyři lokality, album úlovků, mise a odměny.',
        lang: 'cs',
        start_url: '/ryby/',
        scope: '/ryby/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0ea5e9',
        background_color: '#0b2a3d',
        categories: ['games', 'kids', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/ryby/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
