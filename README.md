# Tsundoku Zero — MVP-0 «Edición Amigos»

Leer acompañado, sin spoilers. App social de lectura donde cada usuario fija su
capítulo actual y **jamás ve contenido posterior a su punto de lectura**: el
filtrado se aplica en servidor (Row Level Security de Postgres), nunca solo en
la interfaz.

**Stack:** React + Vite + TypeScript (PWA móvil-primero) · Material Design 3
(tema dinámico desde el seed `#C3492B`) · Supabase (Postgres + Auth + RLS) ·
Vercel.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # rellenar con las credenciales de Supabase
npm run dev
```

Sin `.env.local` la app arranca en modo «pendiente de conectar Supabase».

## Puesta en marcha (una sola vez)

### 1. Supabase

1. Crear cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo
   (plan gratuito, región cercana, p. ej. `eu-west`).
2. En **SQL Editor**, ejecutar en orden todos los archivos de
   `supabase/migrations/` (0001 → 0007) y después:
   - `supabase/seed.sql` (libro con sus 73 capítulos, club y votación)
   - `supabase/seed_discussions.sql` (cuando exista el primer usuario:
     siembra 5 conversaciones para que nadie llegue a una sala vacía)
3. En **Authentication → Providers → Email**: dejar activada la verificación
   («Confirm email»).
4. En **Settings → API**, copiar `Project URL` y `anon public key` a
   `.env.local`.

### 2. GitHub + Vercel

1. Crear repo en GitHub y hacer push de este proyecto.
2. En [vercel.com](https://vercel.com): **Import Project** desde el repo
   (framework: Vite; los valores por defecto sirven).
3. Añadir en Vercel las variables de entorno de `.env.example`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_INVITE_CODE`,
   `VITE_AUTH_GOOGLE_ENABLED=false`).
4. Deploy. En Supabase → **Authentication → URL Configuration**, poner la URL
   de Vercel como `Site URL` (para los enlaces de verificación de correo).

### 3. Primeros usuarios

El primer usuario que complete el onboarding se convierte automáticamente en
**capitán** del club «Tsundoku Zero». Los siguientes entran como miembros y el
trigger de auto-follow los conecta entre sí.

## Reglas de negocio clave (viven en `supabase/migrations/…_rls.sql`)

- **Spoiler gate:** solo se leen/escriben discusiones de capítulos ≤ tu
  progreso. Sin progreso en un libro no ves nada de él.
- **Club:** primer miembro = capitán; auto-follow bidireccional al unirse;
  solo el capitán crea/cierra votaciones (la ganadora se calcula al cerrar).
- **Votos:** uno por persona y poll; se puede cambiar mientras esté abierta.

## Documentación de producto

Plan MVP-0, mockups e historias de usuario en `C:\Users\USER\Downloads\`
(`Tsundoku_Zero_Plan_MVP0.md`, `tsundoku_zero_mockups.html`,
`Tsundoku_Zero_Historias_de_Usuario.docx`).
