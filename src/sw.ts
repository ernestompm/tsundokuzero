/// <reference lib="webworker" />
/**
 * Service worker de Tsundoku Zero (estrategia injectManifest).
 *
 * Hace lo mismo que el generateSW anterior (precache + navegación SPA
 * sin interceptar la API de Supabase) y añade Web Push: mostrar la
 * notificación y abrir la app en la pantalla correcta al tocarla.
 */
declare let self: ServiceWorkerGlobalScope

import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Equivalente a registerType: 'autoUpdate'
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: toda navegación sirve index.html… salvo la API y el auth
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/rest\//, /^\/auth\//],
  }),
)

/* ===================== Web Push ===================== */

interface PushPayload {
  title?: string
  body?: string
  url?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    /* payload no-JSON: se usa el texto plano como cuerpo */
    data = { body: event.data?.text() }
  }
  const title = data.title ?? 'Tsundoku Zero'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? 'Tienes un aviso nuevo',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'es',
      data: { url: data.url ?? '/notifications' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'
  event.waitUntil(
    (async () => {
      // Si la app ya está abierta, reutilizarla; si no, abrir ventana
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
