import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { AuthProvider } from './auth/AuthContext'
import { ComposeProvider } from './components/ComposeProvider'
import { ConfirmProvider } from './components/ConfirmProvider'
import RequireAuth from './auth/RequireAuth'
import TermsGate from './auth/TermsGate'
import AppShell from './components/AppShell'
import LoginPage from './auth/LoginPage'
import OnboardingPage from './auth/OnboardingPage'
import FeedPage from './features/feed/FeedPage'
import BookPage from './features/book/BookPage'
import ClubBookRedirect from './features/book/ClubBookRedirect'
import ChapterPage from './features/book/ChapterPage'
import ThreadPage from './features/book/ThreadPage'
import ClubPage from './features/club/ClubPage'
import ClubManagePage from './features/club/ClubManagePage'
import ProfilePage from './features/profile/ProfilePage'
import UserProfilePage from './features/profile/UserProfilePage'
import AuthorPage from './features/author/AuthorPage'
import NotificationsPage from './features/notifications/NotificationsPage'
import ExplorePage from './features/explore/ExplorePage'
import LibraryPage from './features/library/LibraryPage'

/* Rutas raras o pesadas en chunks aparte (auditoría M-13): el panel de
   administración (~solo superadmin), los textos legales, las vistas de
   diseño y el restablecimiento de contraseña no viajan en el bundle
   inicial de todos los usuarios. */
const AdminPage = lazy(() => import('./features/admin/AdminPage'))
const LegalPage = lazy(() => import('./features/legal/LegalPage'))
const ResetPasswordPage = lazy(() => import('./auth/ResetPasswordPage'))
const PreviewRoutes = lazy(() => import('./features/preview/PreviewRoutes'))

function RouteFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <md-circular-progress indeterminate aria-label="Cargando" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <ComposeProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Textos legales: PÚBLICOS, sin login (LSSI art. 10, RGPD 12-13) */}
              <Route path="/legal/:doc" element={<LegalPage />} />

              {/* Vistas de diseño: solo en desarrollo (auditoría B-06) */}
              {import.meta.env.DEV && (
                <Route path="/preview/*" element={<PreviewRoutes />} />
              )}

              <Route element={<RequireAuth />}>
                <Route path="/onboarding" element={<OnboardingPage />} />
                {/* Desde el enlace del correo de recuperación (C-01) */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                {/* TermsGate: exige aceptación vigente de términos (RGPD art. 7) */}
                <Route element={<TermsGate />}>
                  <Route element={<AppShell />}>
                    <Route index element={<FeedPage />} />
                    <Route path="explore" element={<ExplorePage />} />
                    <Route path="library" element={<LibraryPage />} />
                    <Route path="book" element={<ClubBookRedirect />} />
                    <Route path="book/:bookId" element={<BookPage />} />
                    <Route
                      path="book/:bookId/chapter/:number"
                      element={<ChapterPage />}
                    />
                    <Route path="thread/:discussionId" element={<ThreadPage />} />
                    <Route path="club" element={<ClubPage />} />
                    <Route path="club/manage" element={<ClubManagePage />} />
                    <Route path="me" element={<ProfilePage />} />
                    <Route path="u/:username" element={<UserProfilePage />} />
                    <Route path="author/:authorId" element={<AuthorPage />} />
                    <Route
                      path="notifications"
                      element={<NotificationsPage />}
                    />
                    <Route path="admin" element={<AdminPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ComposeProvider>
      </ConfirmProvider>
    </AuthProvider>
  )
}
