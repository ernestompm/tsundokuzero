import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// La versión vive en package.json y se inyecta en la app (menú lateral).
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // SW propio (src/sw.ts): precache + navegación SPA + Web Push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Tsundoku Zero',
        short_name: 'Tsundoku',
        description: 'Leer acompañado, sin spoilers.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F3EC',
        theme_color: '#40513B',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Con injectManifest, el globPatterns alimenta self.__WB_MANIFEST;
      // la ruta de navegación (con su denylist) vive en src/sw.ts.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
