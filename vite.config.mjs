import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

/* Ein Renderer, zwei Ziele: Der Electron-Build lädt dieselbe Ausgabe wie
   bisher; zusätzlich entsteht eine installierbare, offlinefähige Web-App.
   Der Service Worker wird nur für den Web-Build gebraucht – in Electron
   liegt die App unter file:// und registriert ihn gar nicht erst. */
const THEME = '#394d3e';   // Tafelgrün, --board aus dem Designsystem
const BACKGROUND = '#fbf8f0'; // Papier, --bg

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,          // Registrierung erfolgt im Code, plattformabhängig
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Prép-ybara – Unterrichtsvorbereitung',
        short_name: 'Prép-ybara',
        description: 'Unterrichtsvorbereitung und Jahresplanung. Alle Daten bleiben auf deinem Gerät.',
        lang: 'de',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: THEME,
        background_color: BACKGROUND,
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-48.png',  sizes: '48x48',   type: 'image/png' },
          { src: 'icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Der App-Shell wird vollständig vorgehalten, damit die App ohne
        // Netz startet. Schriften und Bilder gehören dazu.
        globPatterns: ['**/*.{js,css,html,woff2,webp,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  }
});
