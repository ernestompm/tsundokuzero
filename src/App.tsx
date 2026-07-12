import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import LoginPage from './auth/LoginPage'
import FeedPage from './features/feed/FeedPage'
import BookPage from './features/book/BookPage'
import ClubPage from './features/club/ClubPage'
import ProfilePage from './features/profile/ProfilePage'
import PeoplePage from './features/people/PeoplePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<FeedPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="club" element={<ClubPage />} />
        <Route path="me" element={<ProfilePage />} />
        <Route path="people" element={<PeoplePage />} />
      </Route>
    </Routes>
  )
}
