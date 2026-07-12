import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import AppShell from './components/AppShell'
import LoginPage from './auth/LoginPage'
import OnboardingPage from './auth/OnboardingPage'
import FeedPage from './features/feed/FeedPage'
import BookPage from './features/book/BookPage'
import ClubPage from './features/club/ClubPage'
import ProfilePage from './features/profile/ProfilePage'
import PeoplePage from './features/people/PeoplePage'
import AdminPage from './features/admin/AdminPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppShell />}>
            <Route index element={<FeedPage />} />
            <Route path="book" element={<BookPage />} />
            <Route path="club" element={<ClubPage />} />
            <Route path="me" element={<ProfilePage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
