const BASE = import.meta.env.VITE_API_BASE || ''
const getToken = () => localStorage.getItem('kt_token') || ''

async function fetchJSON(path, opts = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  }
  const res = await fetch(BASE + path, { ...opts, headers })
  if (res.status === 401) { localStorage.removeItem('kt_token'); window.location.reload(); throw new Error('Session expired') }
  if (!res.ok) { const t = await res.text(); throw new Error(t || res.statusText) }
  if (res.status === 204) return null
  return res.json()
}

export const login = (password) => fetchJSON('/api/login', { method: 'POST', body: JSON.stringify({ password }) })

export const getPlayers = () => fetchJSON('/api/players')
export const addPlayer = (name, tag, timezone) => fetchJSON('/api/players', { method: 'POST', body: JSON.stringify({ name, tag, timezone }) })
export const updatePlayer = (id, data) => fetchJSON(`/api/players/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePlayer = (id) => fetchJSON(`/api/players/${id}`, { method: 'DELETE' })

export const getEntries = (month) => fetchJSON(`/api/entries?month=${month}`)
export const upsertEntry = (player_id, date, kills, tagtime) =>
  fetchJSON('/api/entries', { method: 'POST', body: JSON.stringify({ player_id, date, kills, tagtime }) })

export const getMonthly = (month) => fetchJSON(`/api/monthly?month=${month}`)
export const upsertMonthly = (player_id, year, month, kills) =>
  fetchJSON('/api/monthly', { method: 'POST', body: JSON.stringify({ player_id, year, month, kills }) })

export const getPeriods = () => fetchJSON('/api/periods')
export const addPeriod = (data) => fetchJSON('/api/periods', { method: 'POST', body: JSON.stringify(data) })
export const updatePeriod = (id, data) => fetchJSON(`/api/periods/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePeriod = (id) => fetchJSON(`/api/periods/${id}`, { method: 'DELETE' })

export const getLeaderboard = (month) => fetchJSON(`/api/leaderboard?month=${month}`)
export const getCompare = (month, playerIds) => fetchJSON(`/api/compare?month=${month}&players=${playerIds.join(',')}`)
