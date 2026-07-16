import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ComposeProvider } from './components/ComposeProvider'
import ComposeSheet from './components/ComposeSheet'
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
import ClubBookRedirect from './features/book/ClubBookRedirect'
import ChapterPage from './features/book/ChapterPage'
import ChapterView from './features/book/ChapterView'
import { SAMPLE_CHAPTER } from './features/book/sampleChapter'
import ThreadPage from './features/book/ThreadPage'
import ThreadView from './features/book/ThreadView'
import { SAMPLE_THREAD } from './features/book/sampleThread'
import ClubPage from './features/club/ClubPage'
import ClubManagePage from './features/club/ClubManagePage'
import ProfilePage from './features/profile/ProfilePage'
import UserProfilePage from './features/profile/UserProfilePage'
import AuthorPage from './features/author/AuthorPage'
import AuthorPreview from './features/author/AuthorPreview'
import NotificationsPage from './features/notifications/NotificationsPage'
import ExplorePage from './features/explore/ExplorePage'
import LibraryPage from './features/library/LibraryPage'
import AdminPage from './features/admin/AdminPage'

export default function App() {
  return (
    <AuthProvider>
      <ComposeProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Vista de diseño sin login (revisión de apariencia) */}
        <Route path="/preview" element={<AppShell />}>
          <Route
            index
            element={
              <HomeView
                data={SAMPLE_HOME}
                onReact={() => {}}
                onReply={() => {}}
                onDeleteItem={() => {}}
              />
            }
          />
          <Route
            path="book"
            element={
              <BookView
                data={SAMPLE_BOOK}
                onSetChapter={() => {}}
                onOpenChapter={() => {}}
                onRate={() => {}}
                onAddToShelf={() => {}}
              />
            }
          />
          <Route
            path="chapter"
            element={
              <ChapterView
                data={SAMPLE_CHAPTER}
                onPublish={() => {}}
                onReply={() => {}}
                onReact={() => {}}
              />
            }
          />
          <Route
            path="compose"
            element={
              <ComposeSheet
                open
                targets={[
                  {
                    bookId: 'sample',
                    bookTitle: 'La Biblioteca de la Medianoche',
                    chapterNumber: 18,
                    chapterLabel: 'El tablero de ajedrez',
                    clubId: 'club',
                  },
                ]}
                onPublish={() => {}}
                onClose={() => {}}
              />
            }
          />
          <Route path="author" element={<AuthorPreview />} />
          <Route
            path="thread"
            element={
              <ThreadView
                data={SAMPLE_THREAD}
                currentUserId="e"
                onReply={() => {}}
                onReact={() => {}}
                onDeleteComment={() => {}}
                onDeleteDiscussion={() => {}}
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
            <Route path="book" element={<ClubBookRedirect />} />
            <Route path="book/:bookId" element={<BookPage />} />
            <Route path="book/:bookId/chapter/:number" element={<ChapterPage />} />
            <Route path="thread/:discussionId" element={<ThreadPage />} />
            <Route path="club" element={<ClubPage />} />
            <Route path="club/manage" element={<ClubManagePage />} />
            <Route path="me" element={<ProfilePage />} />
            <Route path="u/:username" element={<UserProfilePage />} />
            <Route path="author/:authorId" element={<AuthorPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Routes>
      </ComposeProvider>
    </AuthProvider>
  )
}
