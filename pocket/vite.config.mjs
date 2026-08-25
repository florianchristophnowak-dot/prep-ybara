/* ============================================================
   Bau der Pocket-PWA

   Eigener Bau, eigenes Ausgabeverzeichnis, eigener Service Worker –
   die Desktop-App wird davon nicht berührt. Beide Anwendungen benutzen
   dieselbe Installation im Wurzelverzeichnis; ein zweites
   node_modules-Verzeichnis gäbe es sonst ohne Not.

   Der Service Worker hält den gesamten App-Shell vor. Nach dem ersten
   Aufruf läuft Pocket ohne Netz – das ist keine Zugabe, sondern
   Voraussetzung: im Schulhaus ist Empfang die Ausnahme.

   Alles, was zur Laufzeit gebraucht wird, liegt im Bündel. Es gibt
   keine Anfrage nach aussen: kein CDN, keine Schriften von fremden
   Servern, keine Zählpixel.
   ============================================================ */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.resolve(hier, '..');

const THEME = '#4f6ef7';      // dieselbe Leitfarbe wie Prép-ybara
const BACKGROUND = '#f8f9fc';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,           // Registrierung im Code, siehe src/pwa.js
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Prép-ybara Pocket',
        short_name: 'Pocket',
        description: 'Unterrichtsstunden unterwegs erfassen und in Prép-ybara importieren. Alle Daten bleiben auf dem Gerät.',
        lang: 'de',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        /* Hochformat: Pocket ist für die eine Hand am Gang gedacht,
           nicht für die Tabelle im Querformat. */
        orientation: 'portrait',
        theme_color: THEME,
        background_color: BACKGROUND,
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-48.png', sizes: '48x48', type: 'image/png' },
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  root: hier,
  base: './',
  build: {
    outDir: path.resolve(wurzel, 'dist/pocket'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    /* Nicht 5173: Desktop-Entwicklung und Pocket sollen gleichzeitig
       laufen können. */
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
});
