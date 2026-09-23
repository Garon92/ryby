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
      }),
    ),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
