# Auditoría de seguridad técnica — Tsundoku Zero

**Fecha:** 16 de julio de 2026
**Alcance:** repositorio completo (frontend React/Vite, esquema y RLS de
Supabase/Postgres, políticas de Storage, despliegue en Vercel).
**Metodología:** revisión de código estático, modelado de amenazas por
superficie (auth, autorización a nivel de fila, almacenamiento, cabeceras
HTTP, inyección) y verificación del bundle de producción.

---

## Veredicto

El producto llega a la auditoría **en buena forma**. La decisión
arquitectónica clave —*el cliente nunca decide qué es visible; el gate vive
en Postgres*— está bien ejecutada. No se ha encontrado ningún agujero
directamente explotable. Los hallazgos son de **endurecimiento y defensa en
profundidad**, y todos los de severidad relevante quedan corregidos en este
mismo commit.

### Lo que ya estaba bien hecho (no tocar)

- **RLS estructural** en las 22 tablas, con el *spoiler gate* aplicado en
  servidor (`current_chapter_of`), no en el cliente.
- **Rol de super admin en `auth.users.raw_app_meta_data`** (claim del JWT),
  no en una columna que el propio usuario pudiera editar con su política
  *update-own*. Patrón correcto.
- **Funciones `security definer` con `set search_path` fijo** (evita el
  secuestro de `search_path`), salvo una excepción menor ya corregida.
- **Storage de avatares con propiedad por carpeta `uid/…`** vía RLS.
- **Código de invitación validado EN SERVIDOR** (`complete_onboarding`),
  además del control de UI.
- **`RichText` renderiza Markdown a elementos React sin `innerHTML`**: no hay
  vector de XSS por contenido de admin. No hay `dangerouslySetInnerHTML`,
  `eval` ni `new Function` en todo el árbol.
- **Sin secretos en el repositorio** (`service_role` key ausente; `.env.local`
  correctamente ignorado por git).
- **Notificaciones sin política de INSERT de cliente**: se crean solo por
  triggers `security definer`, imposible suplantar notificaciones ajenas.

---

## Hallazgos y correcciones

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| H1 | **Media** | Sin cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options…). Clickjacking posible; sin mitigación de inyección de contenido. | ✅ Corregido |
| H2 | **Media-baja** | `grant execute on all functions … to anon` (migr. 005/006) rehacía los `revoke` puntuales: `anon` podía *invocar* funciones de administración. El guard interno lo frenaba (`forbidden`), pero viola mínimo privilegio. | ✅ Corregido |
| H3 | **Baja** | Bucket público `avatars` sin límite de tipo MIME ni de tamaño: permitía subir cualquier archivo (HTML/SVG con script) a un bucket servido públicamente. | ✅ Corregido |
| H4 | **Baja** | `is_super_admin()` sin `set search_path`. | ✅ Corregido |
| H5 | **Informativo** | El gate de invitación en cliente (`VITE_INVITE_CODE`, incrustado en el bundle) diverge del código real en `private_settings`. No es un agujero (el servidor es autoritativo), pero es código muerto que confunde. | Recomendación |
| H6 | **Informativo** | Contraseña mínima de 6 caracteres (default de Supabase Auth). | Recomendación |

### H1 — Cabeceras de seguridad HTTP · `vercel.json`

Se añade una batería de cabeceras a todas las respuestas:

- **Content-Security-Policy** restrictiva: `script-src 'self'` (verificado:
  el bundle de producción no tiene scripts inline ni `eval`), `object-src
  'none'`, `base-uri 'self'`, `frame-ancestors 'none'` (anti-clickjacking),
  `form-action 'self'`. `connect-src` limitado a Supabase (REST + realtime
  wss), `googleapis.com` y `openlibrary.org` (las APIs de ISBN que usa
  `BookForm`). `img-src` permite `https:` (portadas de OpenLibrary + avatares
  de Supabase). `style-src` mantiene `'unsafe-inline'` porque Material Web y
  React inyectan estilos en atributo `style` (bajo riesgo: CSS inline no
  ejecuta JS en navegadores modernos).
- **Strict-Transport-Security** con `preload`.
- **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**,
  **Referrer-Policy: strict-origin-when-cross-origin**, **Permissions-Policy**
  (cámara, micrófono, geolocalización, pago… desactivados).

> ⚠️ **Tras el despliegue**, abre la consola del navegador y comprueba que no
> hay violaciones de CSP. Si algo se rompiera, el ajuste está en esa línea de
> `vercel.json`; como red de seguridad puedes cambiar temporalmente el nombre
> de la cabecera a `Content-Security-Policy-Report-Only` para observar sin
> bloquear.

### H2, H3, H4 — Endurecimiento en base de datos · migración `021`

`supabase/migrations/20260716000021_hardening_seguridad.sql` (idempotente):

1. **Revoca `EXECUTE` de `anon` y `PUBLIC`** en todas las RPC de
   administración y de datos personales; `authenticated` las conserva (el
   control real es el guard interno).
2. **`is_super_admin()`** recreada con `set search_path = public, auth`.
3. **Bucket `avatars`** limitado a `image/jpeg|png|webp|avif|gif` y 5 MB
   (SVG excluido a propósito).

---

## Acción requerida del titular

1. **Ejecutar la migración `021`** en el SQL Editor de Supabase (idempotente,
   re-ejecutable sin efectos secundarios).
2. **Desplegar** para que Vercel aplique las cabeceras y **verificar la
   consola** (ver aviso de H1).
3. *(Recomendado, H6)* Subir el mínimo de contraseña a 8+ caracteres en
   Supabase → Authentication → Policies, y activar la protección de
   contraseñas filtradas (HaveIBeenPwned) si está disponible en el plan.
4. *(Opcional, H5)* Eliminar el uso de `VITE_INVITE_CODE` en `LoginPage`
   dejando solo la validación de servidor, para no tener dos fuentes de
   verdad del código de invitación.
