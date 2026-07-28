import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import Nav from './components/Nav'
import LoginPage from './components/LoginPage'
import GridPage from './components/GridPage'
import ComparePage from './components/ComparePage'
import LeaderboardPage from './components/LeaderboardPage'
import PlayersPage from './components/PlayersPage'
import PeriodsPage from './components/PeriodsPage'
import PlayerDetailPage from './components/PlayerDetailPage'

export const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

function parseRoute(hash) {
  const h = hash.replace(/^#\/?/, '')
  const playerMatch = h.match(/^player\/(\d+)$/)
  if (playerMatch) return { page: 'player', id: parseInt(playerMatch[1]) }
  if (h === 'compare') return { page: 'compare' }
  if (h === 'leaderboard') return { page: 'leaderboard' }
  if (h === 'players') return { page: 'players' }
  if (h === 'periods') return { page: 'periods' }
  return { page: 'grid' }
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('kt_token'))
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const h = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2600)
  }, [])

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />

  return (
    <ToastContext.Provider value={showToast}>
      <div className="app">
        <Nav route={route} onLogout={() => { localStorage.removeItem('kt_token'); setAuthed(false) }} />
        <main className="main-content">
          {route.page === 'grid'        && <GridPage />}
          {route.page === 'compare'     && <ComparePage />}
          {route.page === 'leaderboard' && <LeaderboardPage />}
          {route.page === 'players'     && <PlayersPage />}
          {route.page === 'periods'     && <PeriodsPage />}
          {route.page === 'player'      && <PlayerDetailPage id={route.id} />}
        </main>
        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </div>
    </ToastContext.Provider>
  )
}
