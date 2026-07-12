import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Nunca interceptar la API ni el auth de Supabase
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
    }),
  ],
})
