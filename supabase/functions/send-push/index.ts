// ============================================================
// Edge Function send-push · envía Web Push cuando nace un aviso
//
// La llama el trigger notifications_send_push (migr. 023) con
// { notification_id }. NUNCA se fía del payload: relee el aviso
// con service role; si no existe, no envía nada. Así, aunque la
// función es invocable con el anon key, nadie puede fabricar
// pushes falsos (crear notificaciones lo impide la RLS).
//
// Secretos requeridos (Dashboard → Edge Functions → Secrets):
//   VAPID_PRIVATE_KEY  · pareja de la pública de abajo
//   VAPID_SUBJECT      · mailto:tu-correo@dominio.com
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

/** Debe coincidir con VAPID_PUBLIC_KEY de src/lib/push.ts */
const VAPID_PUBLIC_KEY =
  'BFzlH5B13exuv6ct7V1-MJYBcrNPnpqnEYgRXnxTAsEKlvBnqVw3pBKK5jZtT5rIkktU3G5TVR5GUyf7bq4BP_Q'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@tsundokuzero.app',
  VAPID_PUBLIC_KEY,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

/** Título y destino por tipo de aviso (mismos textos que la bandeja). */
function describe(
  type: string,
  actorName: string | null,
  n: { discussion_id: string | null; book_id: string | null },
): { title: string; body: string; url: string } {
  const who = actorName ?? 'Alguien'
  switch (type) {
    case 'reply':
      return {
        title: 'Tsundoku Zero',
        body: `${who} respondió a tu idea`,
        url: n.discussion_id ? `/thread/${n.discussion_id}` : '/notifications',
      }
    case 'unlock':
      return {
        title: 'Tsundoku Zero',
        body: 'Se ha desbloqueado una respuesta a tu mensaje 🔓',
        url: n.discussion_id ? `/thread/${n.discussion_id}` : '/notifications',
      }
    case 'follow':
      return {
        title: 'Tsundoku Zero',
        body: `${who} empezó a seguirte`,
        url: '/notifications',
      }
    case 'poll':
      return {
        title: 'Tsundoku Zero',
        body: 'Votación abierta en tu club: elige el próximo libro 🗳️',
        url: '/club',
      }
    case 'book_done':
      return {
        title: 'Tsundoku Zero',
        body: '¡El club ha terminado el libro! Deja tu reseña ⭐',
        url: n.book_id ? `/book/${n.book_id}` : '/club',
      }
    default:
      return {
        title: 'Tsundoku Zero',
        body: 'Tienes un aviso nuevo',
        url: '/notifications',
      }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const payload = await req.json().catch(() => null)
  const id: string | undefined =
    payload?.notification_id ?? payload?.record?.id
  if (!id) return new Response('missing notification_id', { status: 400 })

  // Releer el aviso: si no existe de verdad, aquí se acaba
  const { data: n } = await supabase
    .from('notifications')
    .select('id, user_id, actor_id, type, discussion_id, book_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!n) return new Response('unknown notification', { status: 404 })

  const [{ data: subs }, { data: actor }] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', n.user_id),
    n.actor_id
      ? supabase
          .from('profiles')
          .select('display_name')
          .eq('id', n.actor_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!subs || subs.length === 0) {
    return new Response('no subscriptions', { status: 200 })
  }

  const message = JSON.stringify(
    describe(n.type, actor?.display_name ?? null, n),
  )

  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
          { TTL: 60 * 60 * 24 },
        )
        sent++
      } catch (e) {
        // 404/410 = suscripción muerta (app desinstalada, permiso retirado)
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', s.endpoint)
        }
      }
    }),
  )

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
