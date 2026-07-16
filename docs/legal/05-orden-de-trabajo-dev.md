# Orden de trabajo — Cumplimiento normativo Tsundoku Zero

**Origen:** [Auditoría legal 16/07/2026](00-auditoria-legal.md)
**Objetivo:** dejar la aplicación en cumplimiento de RGPD/LOPDGDD, LSSI-CE, DSA y buenas prácticas de PI.
**Prioridades:** 🔴 **P0** — bloqueante antes de admitir usuarios fuera del círculo de confianza · 🟠 **P1** — dentro del ciclo siguiente · 🟡 **P2** — antes de salir de beta / crecer.

> Los textos legales ya están redactados en `docs/legal/01-…04-*.md`. El titular debe rellenar los placeholders `[…]` **antes** de publicarlos.

## Estado de implementación (16/07/2026)

| Ticket | Estado | Notas |
|---|---|---|
| P0-1 Páginas legales | ✅ Hecho | `/legal/:doc` público; footers en shell, drawer, login y perfil; los `.md` de `docs/legal` son la única fuente (import `?raw`) |
| P0-2 Consentimiento + edad | ✅ Hecho | Checkbox en alta y onboarding; tabla `consents` (migr. 018); re-aceptación vía `TermsGate` al subir `TERMS_VERSION` |
| P0-3 Self-host iconos | ✅ Hecho | `public/fonts/material-symbols-rounded.woff2` (58 KB); `npm run fetch:icons`; verificado: 0 peticiones externas |
| P0-4 Borrado de cuenta | ✅ Hecho | RPC `delete_own_account()` + confirmación escribiendo el usuario (Perfil → Tus datos) |
| P0-5 Denuncias DSA | ✅ Hecho | Botón 🚩 en ideas, respuestas, muros y perfiles; cola «Denuncias» en admin; notificación `moderation` con motivo (art. 17) |
| P1-6 Exportación de datos | ✅ Hecho | RPC `export_my_data()` → JSON descargable desde el perfil |
| P1-7 Invitación en servidor | ⬜ Pendiente | Requiere edge function o tabla de invitaciones; decidir enfoque |
| P1-8 Procedencia portada/sinopsis | ✅ Hecho | Columnas `cover_source`/`synopsis_source`; BookForm las rellena y avisa de reescribir; atribución visible en la ficha |
| P1-9 Crédito foto de autor | ✅ Hecho | `photo_credit`/`photo_license` obligatorios al guardar foto; pie de foto visible |
| P1-10 Email del fundador | ✅ Hecho | Migr. 018 elimina el trigger `auto_promote_founder` (el email sigue en el historial de git — decisión pendiente del titular) |
| P1-11 Citas con fuente | ✅ Hecho | Citas pasadas a paráfrasis en seed y preview (re-ejecutar `seed_author_matt_haig.sql`) |
| P2-12…16 | ⬜ Pendientes | Sin cambios |
| Extra: datos del titular por UI | ✅ Hecho | Administración → **Legal** (tabla `app_settings`, migr. 019): nombre, NIF, domicilio, emails e inscripción registral se rellenan sin tocar código; los textos legales los inyectan al renderizar y estampan la fecha de publicación |

> ⚠️ **Para activar todo el backend: ejecutar en el SQL Editor `supabase/migrations/20260716000018_compliance.sql` y `20260716000019_legal_settings.sql`.** La UI degrada con mensajes claros si faltan las migraciones. Tras la 019: entrar en Administración → Legal y rellenar los datos del titular (hasta entonces los textos muestran los tokens `[…]`).

---

## 🔴 P0-1 · Páginas legales públicas + enlaces permanentes

**Hallazgo:** A1, B2, D2-D3.

- Crear rutas **públicas (sin login)**: `/legal/aviso-legal`, `/legal/privacidad`, `/legal/cookies`, `/legal/terminos`, renderizando los cuatro documentos de `docs/legal/` (pueden importarse como markdown y pasarse por el renderizador propio, o convertirse a componentes).
- Añadirlas en `src/App.tsx` **fuera** de `RequireAuth`.
- Enlaces permanentes: en el footer del shell (`src/components/AppShell.tsx`, junto a «Tsundoku Zero v… · beta») y en la pantalla de login (`src/auth/LoginPage.tsx`).
- Cada página muestra fecha de última actualización y versión.

**Criterio de aceptación:** un visitante sin cuenta puede leer los cuatro textos; hay enlace visible desde login y desde cualquier pantalla logueada.

## 🔴 P0-2 · Aceptación de términos + declaración de edad en el registro

**Hallazgo:** A2 (RGPD arts. 6-8; LOPDGDD art. 7).

- En el formulario de alta (`src/auth/LoginPage.tsx:104-138`), añadir **checkbox obligatorio, desmarcado por defecto**: «He leído y acepto los [Términos y condiciones] y la [Política de privacidad], y declaro tener al menos 14 años». El botón de crear cuenta queda deshabilitado sin marcarlo.
- **Registrar la aceptación** de forma acreditable: nueva tabla `public.consents` (`user_id`, `doc` (`terms`), `doc_version`, `accepted_at`) o columnas `accepted_terms_version` + `accepted_terms_at` en `profiles`. Escribirla al completar el onboarding (`src/auth/OnboardingPage.tsx:99-103`) usando la versión vigente de los textos.
- Preparar el mecanismo de **re-aceptación**: si `accepted_terms_version` < versión vigente (constante en código), mostrar interstitial de aceptación al entrar.
- Aplicar también al flujo OAuth de Google si se activa (`LoginPage.tsx:154-168`): la aceptación debe capturarse en el onboarding, que es común.

**Criterio de aceptación:** imposible completar el alta sin aceptar; queda fila con versión y timestamp; subir la versión del documento fuerza re-aceptación.

## 🔴 P0-3 · Eliminar Google Fonts remoto (Material Symbols self-hosted)

**Hallazgo:** A3 (transferencia de IP a Google sin consentimiento).

- Sustituir la hoja de estilos de `index.html:20-26` por el subconjunto de Material Symbols **servido desde el propio dominio**: descargar el woff2 del subconjunto (misma URL de subsetting) a `public/fonts/` o vía paquete npm (`material-symbols`), y declarar el `@font-face` localmente. Ya existe `scripts/check-icons.mjs` para mantener la lista de iconos.
- Verificar tras el cambio que **ninguna petición de red sale hacia `fonts.googleapis.com` / `fonts.gstatic.com`** (las fuentes de texto ya son self-hosted vía Fontsource).

**Criterio de aceptación:** pestaña Network sin peticiones a dominios de Google en carga y navegación; los iconos se ven idénticos.

## 🔴 P0-4 · Autoservicio de eliminación de cuenta

**Hallazgo:** A4 (RGPD arts. 12.2 y 17).

- Botón «Eliminar cuenta» en `src/features/profile/ProfilePage.tsx` (zona inferior, junto a «Cerrar sesión»), con confirmación fuerte (reescribir el nombre de usuario o la palabra «eliminar»).
- Backend: RPC `security definer` `delete_own_account()` que borre `auth.users` del propio `auth.uid()` (reutilizar la lógica de cascada de `admin_delete_user`, `supabase/migrations/20260712000006_admin_powers.sql:98-105`) **y** los objetos del bucket `avatars/{uid}/`.
- Tras el borrado: signOut local y redirección a `/`.
- Documentado ya en la política de privacidad (§7) — la UI debe coincidir («Perfil → Eliminar cuenta»).

**Criterio de aceptación:** un usuario elimina su cuenta sin intervención del admin; desaparecen perfil, contenido, avatar y fila en `auth.users`; el email deja de poder iniciar sesión.

## 🔴 P0-5 · Mecanismo de denuncia de contenido (DSA art. 16) + punto de contacto

**Hallazgo:** D1, D2.

- Acción «Denunciar» en el menú de cada publicación/comentario/reseña (discusiones, comentarios, posts, reseñas).
- Tabla `public.reports` (`id`, `reporter_id` nullable —admitir denuncia con email para no registrados si es viable, o al menos email de contacto en las páginas legales—, `target_type`, `target_id`, `reason` (enum: ilegal, acoso, spoiler malintencionado, spam, PI, otros), `details` texto, `status` (`open/reviewed/actioned/dismissed`), `created_at`, `resolved_at`, `resolution_note`).
- Cola de revisión en el panel admin (`src/features/admin/AdminPage.tsx`): listar, marcar resolución y nota. Al retirar contenido, **notificación in-app al autor con el motivo** (DSA art. 17) usando el sistema de `notifications` existente.
- Publicar el email de contacto único en el Aviso legal (ya previsto) — el titular debe crear el buzón.

**Criterio de aceptación:** cualquier usuario denuncia en ≤2 taps; el admin ve la cola; el autor afectado recibe el motivo de la retirada.

---

## 🟠 P1-6 · Exportación de datos (portabilidad, RGPD art. 20)

- Botón «Descargar mis datos» en el perfil: RPC que devuelva JSON con perfil, progreso, reseñas, debates, comentarios, reacciones, votos y follows del propio usuario; descarga como archivo.

## 🟠 P1-7 · Registro: validación del código de invitación en servidor

**Hallazgo:** A10. La validación actual es solo frontend (`LoginPage.tsx:57-60`) con `enable_signup = true` (`supabase/config.toml:32`). Mover la invitación a servidor (hook de Supabase Auth, edge function o tabla de invitaciones canjeables) o desactivar signup abierto.

## 🟠 P1-8 · Sinopsis y cubiertas: procedencia y atribución (PI)

**Hallazgo:** C1, C2.

- `BookForm.tsx`: al importar de Google Books/Open Library, guardar la **fuente** (`books.cover_source`, `books.synopsis_source`).
- No autoimportar la descripción editorial como sinopsis definitiva: mostrarla como borrador con aviso «texto editorial — reescribir» y marcar en el admin las sinopsis no reescritas.
- Mostrar atribución de cubierta en la ficha del libro cuando la fuente lo requiera (p. ej. «Cubierta: Open Library»). Cumplir las condiciones de la API de Google Books si se usan sus miniaturas (enlace de vuelta); en su defecto, preferir Open Library.
- Restringir el campo libre de URL de cubierta a dominios permitidos (allowlist) o exigir declaración de origen/licencia al guardarlo.

## 🟠 P1-9 · Fotos de autor: crédito y licencia obligatorios

**Hallazgo:** C5. Añadir a `authors` columnas `photo_credit` y `photo_license`; el formulario de admin no permite guardar `photo_url` sin ambas. Mostrar el crédito en `AuthorPage.tsx` (pie de foto). Política editorial: solo Wikimedia Commons con licencia compatible o material de prensa editorial.

## 🟠 P1-10 · Retirar el email personal de la migración

**Hallazgo:** A8. Sustituir el email hardcodeado en `supabase/migrations/20260712000003_admin.sql:79-96` por promoción manual vía SQL una sola vez o variable de configuración (`app.settings`), y crear migración correctora que elimine el trigger `auto_promote_founder` si ya no es necesario. *(Nota: el repo es público en GitHub — valorar limpiar también el historial o dar por asumida la exposición.)*

## 🟠 P1-11 · Citas de la ficha de autor con fuente

**Hallazgo:** C4. En `supabase/seed_author_matt_haig.sql` (líneas 35 y 41), añadir la fuente de las citas de críticas («aerodinámica», «emocionalmente real») o eliminarlas. Regla editorial: toda cita lleva obra/medio y autor (LPI art. 32).

---

## 🟡 P2-12 · Avisos y endurecimiento del bucket de avatares

**Hallazgo:** A5. Mantenerlo público es defendible (es una red social y la privacidad lo advierte §3), pero: (a) añadir aviso en la UI de subida («tu foto será accesible públicamente»), (b) valorar nombres de archivo no adivinables (`{uid}/{uuid}.jpg`) y (c) borrar el archivo anterior al reemplazar.

## 🟡 P2-13 · Bloquear/silenciar usuarios

**Hallazgo:** D4. Tabla `blocks` + filtrado del contenido del bloqueado en feed, hilos y notificaciones.

## 🟡 P2-14 · Aviso de contenido sensible

**Hallazgo:** D5. La bio de Matt Haig (y futuros contenidos) trata suicidio/depresión y es accesible sin login. Añadir nota discreta con recursos de ayuda (📞 024 — Línea de atención a la conducta suicida) en fichas que traten estos temas.

## 🟡 P2-15 · Página de estado de moderación / transparencia

Preparar (aunque sea mínima) una sección en las páginas legales que resuma las normas aplicadas y datos agregados de moderación — facilita el cumplimiento DSA art. 15 si el servicio crece y da confianza a la comunidad.

## 🟡 P2-16 · Índice de capítulos sembrado

**Hallazgo:** C3. Riesgo bajo; decisión de negocio. Mitigación disponible: numerar capítulos sin título literal (o título abreviado) para obras cuyo índice traducido se reproduzca íntegro. Documentar el criterio adoptado.

---

## Verificaciones de infraestructura (no son código, pero bloquean el cierre)

| ✔ | Acción | Responsable |
|---|---|---|
| ☐ | Confirmar en el dashboard de Supabase que la región del proyecto `rigiljswurolsockpkfv` es UE (eu-west) | Titular |
| ☐ | Descargar y archivar DPA de Supabase y de Vercel | Titular |
| ☐ | Crear buzón de contacto legal/privacidad (no personal) y ponerlo en los placeholders | Titular |
| ☐ | Rellenar todos los placeholders `[…]` de `docs/legal/01–04` | Titular |
| ☐ | Elaborar el Registro de Actividades de Tratamiento (art. 30 RGPD): un tratamiento por fila de la tabla §2 de la política de privacidad + tratamiento «administración/moderación» | Titular (con plantilla AEPD) |
| ☐ | Configurar SMTP propio o revisar el remitente de los emails de Supabase Auth | Dev/Titular |
| ☐ | Valorar registro de marca «Tsundoku Zero» (OEPM/EUIPO) | Titular |

## Definición de «hecho» global

1. Los cuatro textos legales publicados, enlazados y sin placeholders.
2. Ningún alta sin aceptación registrada (versión + timestamp) y declaración ≥14 años.
3. Cero peticiones de red a terceros no esenciales (verificado en Network).
4. El usuario puede: eliminar su cuenta, exportar sus datos, denunciar contenido.
5. Toda retirada de contenido notifica el motivo al autor.
6. Checklist de infraestructura completa.
