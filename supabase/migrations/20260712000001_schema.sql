-- =====================================================================
-- Tsundoku Zero · MVP-0 — Esquema (Plan MVP-0 §3)
-- Orden de creación ajustado: clubs antes que discussions/posts
-- (las referencian por club_id).
-- =====================================================================

-- Usuarios: Supabase crea auth.users. Extendemos con perfil público.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (length(display_name) between 1 and 50),
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Seguimiento
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followed_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index follows_followed_idx on follows (followed_id);

-- Libros y estructura posicional (v0: capítulo como unidad)
create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  cover_url text,
  total_chapters int not null check (total_chapters > 0)
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  number int not null check (number >= 1),   -- 1..N, orden canónico
  label text,                                -- "Capítulo 7" (v0: numérico)
  unique (book_id, number)
);

-- Progreso de lectura (la clave de todo el producto)
create table reading_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  current_chapter int not null default 0 check (current_chapter >= 0), -- 0 = aún no empezado
  status text not null default 'reading' check (status in ('reading', 'finished', 'want')),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- Clubs
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  description text,
  current_book_id uuid references books(id),
  created_at timestamptz not null default now()
);

create table club_members (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'captain')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- Discusiones ancladas a capítulo + comentarios
create table discussions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  chapter_number int not null check (chapter_number >= 1),  -- posición del ancla
  author_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'comment' check (kind in ('comment', 'theory', 'question', 'reaction')),
  body text not null check (length(body) between 1 and 4000),
  club_id uuid references clubs(id) on delete set null,     -- null = fuera de club
  created_at timestamptz not null default now()
);

create index discussions_book_chapter_idx on discussions (book_id, chapter_number, created_at desc);
create index discussions_author_idx on discussions (author_id, created_at desc);
create index discussions_club_idx on discussions (club_id, created_at desc) where club_id is not null;

create table discussion_comments (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references discussions(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index discussion_comments_discussion_idx on discussion_comments (discussion_id, created_at);

-- Muro personal / blog
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text check (title is null or length(title) <= 120),
  body text not null check (length(body) between 1 and 20000),
  book_id uuid references books(id) on delete set null,     -- opcional: post sobre un libro
  club_id uuid references clubs(id) on delete set null,     -- si se comparte con el club
  visibility text not null default 'followers' check (visibility in ('followers', 'club', 'private')),
  created_at timestamptz not null default now()
);

create index posts_author_idx on posts (author_id, created_at desc);
create index posts_club_idx on posts (club_id, created_at desc) where club_id is not null;

-- Votación mensual del libro
create table polls (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  title text not null,                       -- "Libro de agosto"
  status text not null default 'open' check (status in ('open', 'closed')),
  closes_at timestamptz,
  created_by uuid references profiles(id) on delete set null,  -- debe ser capitán (RLS)
  winner_option_id uuid
);

create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  book_title text not null,
  book_author text not null,
  note text,                                 -- pitch del capitán
  unique (id, poll_id)                       -- permite FK compuesta desde poll_votes
);

create table poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id),            -- un voto por persona y poll
  -- garantiza que la opción votada pertenece a la misma poll
  foreign key (option_id, poll_id) references poll_options(id, poll_id) on delete cascade
);

create index poll_votes_option_idx on poll_votes (option_id);
