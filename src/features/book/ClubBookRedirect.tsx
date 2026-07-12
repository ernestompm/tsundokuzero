import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '@material/web/progress/circular-progress.js'
import { supabase } from '../../lib/supabase'

/** /book (acceso rápido): redirige al libro actual del club, o a la biblioteca. */
export default function ClubBookRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('clubs')
      .select('current_book_id')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.current_book_id)
          navigate(`/book/${data.current_book_id}`, { replace: true })
        else navigate('/library', { replace: true })
      })
  }, [navigate])

  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
      <md-circular-progress indeterminate />
    </div>
  )
}
