import { Route, Routes } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import ComposeSheet from '../../components/ComposeSheet'
import HomeView from '../feed/HomeView'
import { SAMPLE_HOME } from '../feed/sampleHome'
import BookView from '../book/BookView'
import { SAMPLE_BOOK } from '../book/sampleBook'
import ChapterView from '../book/ChapterView'
import { SAMPLE_CHAPTER } from '../book/sampleChapter'
import ThreadView from '../book/ThreadView'
import { SAMPLE_THREAD } from '../book/sampleThread'
import AuthorPreview from '../author/AuthorPreview'

/**
 * Vistas de diseño con datos de muestra (sin login), para revisar la
 * apariencia. Solo se sirven en desarrollo (auditoría B-06) y en un
 * chunk aparte: los datos sample no viajan al bundle de producción
 * (auditoría M-13).
 */
export default function PreviewRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
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
    </Routes>
  )
}
