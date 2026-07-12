import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import AppShell from './components/AppShell'
import LoginPage from './auth/LoginPage'
import OnboardingPage from './auth/OnboardingPage'
import FeedPage from './features/feed/FeedPage'
import HomeView from './features/feed/HomeView'
import { SAMPLE_HOME } from './features/feed/sampleHome'
import BookPage from './features/book/BookPage'
import BookView from './features/book/BookView'
import { SAMPLE_BOOK } from './features/book/sampleBook'
import ChapterPage from './features/book/ChapterPage'
import ClubPage from './features/club/ClubPage'
import ProfilePage from './features/profile/ProfilePage'
import ExplorePage from './features/explore/ExplorePage'
import LibraryPage from './features/library/LibraryPage'
import AdminPage from './features/admin/AdminPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Vista de diseño sin login (revisión de apariencia) */}
        <Route path="/preview" element={<AppShell />}>
          <Route index element={<HomeView data={SAMPLE_HOME} />} />
          <Route
            path="book"
            element={
              <BookView
                data={SAMPLE_BOOK}
                onSetChapter={() => {}}
                onOpenChapter={() => {}}
              />
            }
          />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppShell />}>
            <Route index element={<FeedPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="book" element={<BookPage />} />
            <Route path="chapter/:number" element={<ChapterPage />} />
            <Route path="club" element={<ClubPage />} />
            <Route path="me" element={<ProfilePage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
