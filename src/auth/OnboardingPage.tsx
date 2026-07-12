import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Book, Club } from '../lib/database.types'
import './auth.css'

/**
 * Mini-onboarding de 2 pasos (Plan MVP-0 §5, pantalla 01):
 *   1. Elegir username + nombre visible → crea el perfil.
 *   2. Unirse al club fundador y fijar el capítulo por el que vas
 *      en el libro del mes (0 = aún no empezado).
 */
export default function OnboardingPage() {
  const { session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(profile ? 2 : 1)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [club, setClub] = useState<Club | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [chapter, setChapter] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('clubs')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(async ({ data: clubData }) => {
        setClub(clubData)
        if (clubData?.current_book_id) {
          const { data: bookData } = await supabase
            .from('books')
            .select('*')
            .eq('id', clubData.current_book_id)
            .maybeSingle()
          setBook(bookData)
        }
      })
  }, [])

  const createProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) return
    setError(null)

    const clean = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setError(
        'El usuario debe tener 3–20 caracteres: letras minúsculas, números o _',
      )
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.from('profiles').insert({
        id: session.user.id,
        username: clean,
        display_name: displayName.trim() || clean,
      })
      if (error) {
        setError(
          error.code === '23505'
            ? 'Ese nombre de usuario ya está cogido.'
            : error.message,
        )
        return
      }
      await refreshProfile()
      setStep(2)
    } finally {
      setBusy(false)
    }
  }

  const joinAndSetProgress = async () => {
    if (!session || !club) return
    setError(null)
    setBusy(true)
    try {
      // Unirse al club: el trigger fija el rol (primer miembro = capitán)
      // y crea los follows bidireccionales con los demás miembros.
      const { error: joinError } = await supabase
        .from('club_members')
        .insert({ club_id: club.id, user_id: session.user.id })
      if (joinError && joinError.code !== '23505') {
        setError(joinError.message)
        return
      }

      if (book) {
        const { error: progressError } = await supabase
          .from('reading_progress')
          .upsert({
            user_id: session.user.id,
            book_id: book.id,
            current_chapter: chapter,
          })
        if (progressError) {
          setError(progressError.message)
          return
        }
      }

      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <h1 className="headline-medium">
            {step === 1 ? 'Crea tu identidad lectora' : 'Tu punto de lectura'}
          </h1>
          <p className="body-medium tagline">Paso {step} de 2</p>
        </div>

        {error && <p className="auth-error body-medium">{error}</p>}

        {step === 1 ? (
          <form className="onboarding-step" onSubmit={createProfile}>
            <md-outlined-text-field
              label="Nombre de usuario"
              prefix-text="@"
              required
              supporting-text="Minúsculas, números y _ (3–20)"
              value={username}
              onInput={(e) =>
                setUsername((e.currentTarget as HTMLInputElement).value)
              }
            />
            <md-outlined-text-field
              label="Nombre visible"
              value={displayName}
              supporting-text="Como te verán los demás (opcional)"
              onInput={(e) =>
                setDisplayName((e.currentTarget as HTMLInputElement).value)
              }
            />
            <md-filled-button type="submit" disabled={busy || undefined}>
              Continuar
            </md-filled-button>
          </form>
        ) : (
          <div className="onboarding-step">
            {club && book ? (
              <>
                <p className="body-large" style={{ textAlign: 'center' }}>
                  Te unes al club <b>{club.name}</b>, que está leyendo{' '}
                  <em className="serif">{book.title}</em> de {book.author}.
                </p>
                <p
                  className="body-medium on-surface-variant"
                  style={{ textAlign: 'center' }}
                >
                  ¿Por qué capítulo vas? Solo verás conversaciones hasta ese
                  punto — jamás un spoiler.
                </p>
                <div className="onboarding-progress-row">
                  <md-icon-button
                    aria-label="Capítulo anterior"
                    disabled={chapter <= 0 || undefined}
                    onClick={() => setChapter((c) => Math.max(0, c - 1))}
                  >
                    <span className="material-symbols-rounded">remove</span>
                  </md-icon-button>
                  <span className="onboarding-chapter headline-small">
                    {chapter === 0 ? 'Sin empezar' : `Capítulo ${chapter}`}
                  </span>
                  <md-icon-button
                    aria-label="Capítulo siguiente"
                    disabled={chapter >= book.total_chapters || undefined}
                    onClick={() =>
                      setChapter((c) => Math.min(book.total_chapters, c + 1))
                    }
                  >
                    <span className="material-symbols-rounded">add</span>
                  </md-icon-button>
                </div>
                <md-filled-button
                  type="button"
                  disabled={busy || undefined}
                  onClick={joinAndSetProgress}
                >
                  Empezar a leer acompañado
                </md-filled-button>
              </>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
                <md-circular-progress indeterminate />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
