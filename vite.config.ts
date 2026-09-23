/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { g92Pwa } from './src/kit/pwa.ts';

export default defineConfig({
  base: '/ryby/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  plugins: [
    VitePWA(
      g92Pwa('ryby', {
        name: 'Ryby – rybářská hra',
        description: 'Nahoď prut a chytej české ryby v rybníce, řece, potoce i na přehradě. Album 59 druhů, mise a odměny.',
        // předem jen aplikace + malé náhledy ryb (album offline); velké obrázky ryb se ukládají až při použití
        // (dřív se na pozadí stahoval celý atlas 2+ MB – QA RYBY-12), italic písma se nepoužívají
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}', 'assets/*-normal-*.woff2', 'fish/thumb/*.webp'],
        runtimeCaching: [
          {
            urlPattern: /\/fish\/[a-z_]+\.webp$/,
            handler: 'CacheFirst',
            options: { cacheName: 'ryby-fish', expiration: { maxEntries: 80 } },
          },
        ],
      }),
    ),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
