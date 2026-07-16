import { supabase } from './supabase'

/**
 * Web Push del lado del cliente: suscribir/desuscribir este dispositivo.
 *
 * La clave VAPID pública es pública por diseño (identifica al servidor
 * ante el servicio de push del navegador). Su pareja privada vive SOLO
 * en los secretos de la Edge Function send-push.
 */
export const VAPID_PUBLIC_KEY =
  'BFzlH5B13exuv6ct7V1-MJYBcrNPnpqnEYgRXnxTAsEKlvBnqVw3pBKK5jZtT5rIkktU3G5TVR5GUyf7bq4BP_Q'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** ¿Este navegador puede recibir push? (en iPhone: solo PWA instalada) */
export function pushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** ¿Hay ya una suscripción activa en este dispositivo? */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  if (Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) != null
}

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'error'

/** Pide permiso, suscribe este dispositivo y lo guarda en Supabase. */
export async function enablePush(userId: string): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))

    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return 'error'
    }
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: json.endpoint,
        user_id: userId,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' },
    )
    return error ? 'error' : 'ok'
  } catch {
    return 'error'
  }
}

/** Borra la suscripción de este dispositivo (local y en Supabase). */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {
    /* sin drama: en el peor caso la Edge Function limpiará el endpoint muerto */
  }
}
