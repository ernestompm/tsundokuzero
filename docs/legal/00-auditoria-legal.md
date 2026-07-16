# Auditoría de cumplimiento normativo — Tsundoku Zero

**Fecha:** 16 de julio de 2026
**Versión auditada:** 0.4.0 (commit `6acb6d2`)
**Alcance:** revisión del código fuente, esquema de base de datos, infraestructura declarada y contenidos sembrados. No incluye revisión de la configuración del dashboard de Supabase ni de Vercel (se señalan como verificaciones pendientes).
**Naturaleza del servicio:** red social de lectura ("leer acompañado, sin spoilers"), en español, en fase beta cerrada por invitación. Hospedada en Vercel; backend, autenticación y almacenamiento en Supabase. Enlaces de compra a Amazon.es.

> ⚠️ Este documento es un análisis técnico-jurídico preparatorio. No sustituye el asesoramiento de un abogado colegiado con conocimiento completo de la situación del titular (forma jurídica, actividad económica, sede).

---

## 1. Marco normativo aplicable

| Norma | Aplicabilidad |
|---|---|
| **RGPD** (Reglamento UE 2016/679) | Sí. Se tratan datos personales de usuarios (email, perfil, avatar, hábitos de lectura, grafo social). |
| **LOPDGDD** (LO 3/2018) | Sí. Servicio dirigido a público español; relevante el art. 7 (edad mínima 14 años). |
| **LSSI-CE** (Ley 34/2002) | Sí. Servicio de la sociedad de la información; los enlaces de compra a Amazon constituyen actividad con trascendencia económica indirecta. Obligaciones: identificación del prestador (art. 10) e información sobre cookies (art. 22.2). |
| **DSA** (Reglamento UE 2022/2065) | Sí, como servicio de alojamiento de datos/plataforma que difunde contenido de usuarios. Como micro/pequeña empresa está exenta de la Sección 3 (art. 19), pero **no** de: puntos de contacto (arts. 11-12), condiciones generales con normas de moderación (art. 14), mecanismo de notificación y acción (art. 16) y motivación de decisiones de moderación (art. 17). |
| **LPI** (RDL 1/1996) | Sí. Se muestran cubiertas de libros, sinopsis editoriales, títulos de capítulos de obras traducidas, biografías y (previsiblemente) fotos de autores. |
| **Ley 11/2023 (accesibilidad, EAA)** | Previsiblemente exenta como microempresa, pero se recomienda seguir WCAG 2.1 AA como buena práctica. |
| **Marcas (Ley 17/2001)** | Recomendación: búsqueda de anterioridades y registro de «Tsundoku Zero» (OEPM/EUIPO). |

---

## 2. Hallazgos

Clasificación de riesgo: 🔴 **Crítico** (incumplimiento actual con exposición sancionadora directa) · 🟠 **Alto** (incumplimiento probable o riesgo material) · 🟡 **Medio** (riesgo gestionable / mejora necesaria) · 🟢 **Bajo** (observación).

### A. Protección de datos (RGPD / LOPDGDD)

| # | Hallazgo | Evidencia | Riesgo | Norma |
|---|---|---|---|---|
| A1 | **No existe política de privacidad ni información alguna del art. 13 RGPD.** No hay página, enlace ni texto informativo en toda la app. | Búsqueda exhaustiva sin resultados; rutas en `src/App.tsx:37-127` sin páginas legales; shell sin footer legal (`src/components/AppShell.tsx:175-177`) | 🔴 | RGPD arts. 12-13; LOPDGDD art. 11 |
| A2 | **El registro no recaba aceptación de términos ni declaración de edad.** El alta solo pide email, contraseña e invitación. No hay verificación de edad ≥14 años. | `src/auth/LoginPage.tsx:104-138`; `OnboardingPage.tsx` completo | 🔴 | RGPD arts. 6-8; LOPDGDD art. 7 |
| A3 | **Carga de Google Fonts desde servidores de Google en cada visita** (iconos Material Symbols). Transfiere la IP de cada visitante a Google sin consentimiento ni base jurídica informada. Las fuentes de texto sí son self-hosted. | `index.html:20-26` | 🟠 | RGPD arts. 6, 44 y ss. (doctrina «Google Fonts», LG München I 3 O 17493/20) |
| A4 | **No existe autoservicio de supresión de cuenta.** El derecho de supresión solo puede ejercerse a través del admin, sin canal informado. | `ProfilePage.tsx:485-487` (solo «Cerrar sesión»); borrado solo vía `admin_delete_user` | 🟠 | RGPD arts. 12.2 y 17 |
| A5 | **Avatares en bucket público sin autenticación**: cualquier persona (incluso sin cuenta) puede acceder a la foto de perfil conociendo la URL (`{uid}/avatar.jpg`, uid predecible dentro de la app). | `supabase/migrations/20260716000016_fotos_autor_avatares.sql:14-21` | 🟡 | RGPD arts. 5.1.f, 25, 32 |
| A6 | **Sin registro de actividades de tratamiento (RAT)** ni encargos de tratamiento documentados (Supabase, Vercel). El tratamiento no es ocasional, por lo que la exención del art. 30.5 no ampara. | No existe documentación en el repo | 🟠 | RGPD arts. 28 y 30 |
| A7 | **Transferencias internacionales sin verificar**: región del proyecto Supabase sin confirmar (README recomienda eu-west); Vercel (EE. UU., adherida al DPF); Google Fonts (EE. UU.). | `supabase/config.toml:3-4`; README.md:27, 38-47 | 🟡 | RGPD cap. V |
| A8 | **Email personal del fundador incrustado en una migración SQL** publicada en un repo remoto. | `supabase/migrations/20260712000003_admin.sql:79-96` | 🟢 | Higiene de datos / seguridad |
| A9 | Los administradores ven el email de todos los usuarios (esperable, pero debe constar en el RAT y en la política de privacidad). | `admin.sql:25-49`; `AdminPage.tsx:108-116` | 🟢 | RGPD art. 13.1.e |
| A10 | **Validación del código de invitación solo en cliente**: el alta directa contra la API de Supabase no exige código (`enable_signup = true`). Riesgo de seguridad y de altas no controladas. | `LoginPage.tsx:57-60`; `supabase/config.toml:32` | 🟡 | RGPD art. 32 (medidas de seguridad) |
| A11 | Sin derecho de portabilidad instrumentado (export de datos propios). | — | 🟡 | RGPD art. 20 |

**Puntos favorables:** no hay analítica ni píxeles de terceros; no hay marketing por email; el markdown de usuario no admite HTML crudo (`RichText.tsx:17`); RLS activa por tabla; el recorte de avatar en cliente re-codifica la imagen (elimina EXIF/geolocalización); verificación de email activada.

### B. Cookies y almacenamiento local (LSSI art. 22.2)

| # | Hallazgo | Evidencia | Riesgo |
|---|---|---|---|
| B1 | Solo se usa almacenamiento **técnico exento de consentimiento**: preferencia de tema (`tz-theme-mode`), token de sesión de Supabase (`sb-…-auth-token`) y caché del service worker PWA. **No hay cookies de terceros ni analítica.** | `src/theme/theme.ts:11,100,122-123`; `src/lib/supabase.ts:14-17`; `vite.config.ts:18-46` | 🟢 |
| B2 | **No existe página informativa de cookies.** Aunque el almacenamiento actual está exento de consentimiento (Guía de cookies AEPD), la información sobre su uso debe estar disponible. | — | 🟡 |
| B3 | **No se necesita banner de cookies** en el estado actual. Si en el futuro se añade analítica o publicidad, será obligatorio un gestor de consentimiento previo. | — | 🟢 (condicionado) |

### C. Propiedad intelectual (LPI)

| # | Hallazgo | Evidencia | Riesgo | Análisis |
|---|---|---|---|---|
| C1 | **Hotlinking sistemático de cubiertas de libros** desde Google Books, Open Library o cualquier URL que pegue el admin, sin licencia declarada ni atribución. | `BookForm.tsx:48-58, 69, 90, 99, 116, 264-272`; `AdminPage.tsx:490-498`; `seed_books_isbn.sql:66` | 🟠 | Las cubiertas son obra protegida. El uso identificativo de cubiertas es práctica tolerada del sector, pero conviene: (i) limitar orígenes a fuentes con condiciones de uso conocidas (Open Library Covers API permite el uso; Google Books exige cumplir sus ToS y branding), (ii) atribuir la fuente, (iii) prohibir la URL libre arbitraria o exigir al admin declarar el origen. |
| C2 | **Importación automática de sinopsis editoriales** desde Google Books/Open Library a `books.synopsis`. El copy de contracubierta es texto con copyright de la editorial. | `BookForm.tsx:57, 95-105` | 🟠 | Sustituir por sinopsis de redacción propia o extractos breves entrecomillados con fuente. Las sinopsis sembradas a mano aparentan redacción propia (riesgo bajo). |
| C3 | **Índice completo (73 títulos de capítulo) de la traducción española de *La Biblioteca de la Medianoche*** en seeds y datos de muestra. | `supabase/seed.sql:31-105`; `sampleBook.ts:3-24` | 🟡 | Títulos aislados carecen normalmente de originalidad suficiente; la reproducción del índice íntegro de una traducción es zona gris. Riesgo práctico bajo (uso funcional para anclar debates), pero documentar el criterio y no reproducir prosa. Verificado: `sampleChapter.ts` y seeds de discusión **no** reproducen texto de la obra. |
| C4 | **Biografías de autor**: la ficha de Matt Haig es redacción propia/sintetizada (correcto), pero incluye citas breves de críticas sin identificar la fuente. | `seed_author_matt_haig.sql:35, 41` | 🟢 | El derecho de cita (LPI art. 32) exige indicar fuente y autor. Añadir atribución. |
| C5 | **Fotos de autor por URL libre** (`authors.photo_url`, la edita el admin): las fotografías de autores tienen copyright del fotógrafo. | `20260716000016_fotos_autor_avatares.sql:6-7`; `AuthorPage.tsx:197` | 🟠 | Política interna: solo imágenes con licencia (Wikimedia Commons con licencia compatible, kits de prensa editoriales) + campo de crédito/licencia obligatorio. |
| C6 | **Sin cesión de licencia sobre el contenido de usuarios (UGC)**: no hay términos que otorguen al servicio derecho a reproducir/comunicar las reseñas y comentarios de los usuarios. | Sin ToS | 🟠 | Imprescindible cláusula de licencia no exclusiva en los Términos. |
| C7 | Marca «Tsundoku Zero» sin registrar (no consta). | — | 🟡 | Búsqueda de anterioridades + registro OEPM/EUIPO clase 41/42/45 antes de crecer. |
| C8 | Enlaces de compra a Amazon sin tag de afiliado. Si se añade afiliación en el futuro, deberá indicarse (comunicación comercial, LSSI art. 20). | `BookView.tsx:144-155`; `BookForm.tsx:135` | 🟢 |

### D. DSA y contenido de usuarios

| # | Hallazgo | Evidencia | Riesgo |
|---|---|---|---|
| D1 | **Sin mecanismo de notificación y acción** (reportar contenido) para usuarios ni visitantes. | Sin resultados en `src/` | 🟠 (DSA art. 16) |
| D2 | **Sin punto de contacto único** publicado para autoridades y usuarios. | — | 🟠 (DSA arts. 11-12) |
| D3 | **Sin condiciones generales que describan las normas de moderación** (qué se permite, qué no, y cómo se decide). La moderación existe pero es discrecional del superadmin. | `AdminPage.tsx:239-355` | 🟠 (DSA arts. 14 y 17) |
| D4 | Sin función de bloqueo/silenciado entre usuarios. No es obligación legal directa, pero es mitigación estándar de riesgos. | — | 🟢 |
| D5 | Contenido sensible (depresión, suicidio en la bio de Matt Haig) accesible **sin login** en `/preview/author`, sin aviso de contenido. | `AuthorPreview.tsx:8-45`; `App.tsx:95` | 🟢 (buena práctica: aviso + recursos de ayuda, p. ej. 024) |

---

## 3. Dictamen resumido

En su estado actual, la aplicación **no puede abrirse al público general** sin subsanar los hallazgos críticos: carece por completo de capa informativa legal (A1), el registro no articula base jurídica ni control de edad (A2) y hay una transferencia no consentida a Google en cada visita (A3). En beta cerrada con usuarios de confianza la exposición práctica es reducida, pero las obligaciones ya son exigibles desde el primer usuario real.

La buena noticia: la arquitectura es inusualmente limpia en privacidad (sin trackers, sin analítica, almacenamiento técnico exento), por lo que **no se necesita banner de cookies** si se corrige A3. Con los tickets P0 de la [orden de trabajo](05-orden-de-trabajo-dev.md) resueltos, el servicio queda en posición de cumplimiento razonable para su escala.

**Prioridad de remediación:** ver [orden de trabajo](05-orden-de-trabajo-dev.md). Textos legales listos para integrar: [Aviso legal](01-aviso-legal.md) · [Privacidad](02-politica-privacidad.md) · [Cookies](03-politica-cookies.md) · [Términos](04-terminos-condiciones.md).

**Acciones no técnicas pendientes del titular:**
1. Completar los placeholders `[…]` de los textos legales (identidad, NIF, domicilio, email de contacto — se recomienda un buzón dedicado tipo `legal@` / `privacidad@`, no un email personal).
2. Elaborar el registro de actividades de tratamiento (art. 30 RGPD) — plantilla en el anexo de la orden de trabajo.
3. Descargar y archivar los DPA de Supabase y Vercel; confirmar en el dashboard de Supabase que la región del proyecto es UE.
4. Valorar registro de marca «Tsundoku Zero».
5. Designar el punto de contacto DSA (puede ser el mismo buzón).
