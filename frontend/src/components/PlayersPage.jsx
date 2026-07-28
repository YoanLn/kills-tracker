import React, { useState, useEffect } from 'react'
import { getPlayers, addPlayer, updatePlayer, deletePlayer } from '../api'
import { useToast } from '../App'

const TZ = [{ value: '', label: 'Timezone' }, { value: 'EU', label: 'Europe' }, { value: 'NA', label: 'NA' }, { value: 'AS', label: 'Asia' }]
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6']

function avatarColor(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[h % COLORS.length]
}
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PlayersPage() {
  const showToast = useToast()
  const [players, setPlayers] = useState([])
  const [name, setName] = useState('')
  const [tz, setTz] = useState('')
  const [joinedDate, setJoinedDate] = useState('')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})

  async function load() { setPlayers(await getPlayers()) }
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await addPlayer(name.trim(), tz, joinedDate || null)
      setName(''); setTz(''); setJoinedDate('')
      load(); showToast('Player added')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function saveEdit(p) {
    try {
      await updatePlayer(p.id, { ...editData, joined_date: editData.joined_date || null })
      setEditing(null); load(); showToast('Player updated')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function remove(p) {
    if (!confirm(`Delete ${p.name}? All their entries will be removed.`)) return
    try { await deletePlayer(p.id); load(); showToast('Player deleted', 'error') }
    catch (err) { showToast(err.message, 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Players <span className="count-chip">{players.length}</span></h1>
      </div>

      <div className="card">
        <h3 className="card-title">Add Player</h3>
        <form onSubmit={submit} className="form-row">
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required />
          <select className="input select-auto" value={tz} onChange={e => setTz(e.target.value)}>
            {TZ.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input className="input" type="date" value={joinedDate} onChange={e => setJoinedDate(e.target.value)} title="Join date" />
          <button className="btn" type="submit">+ Add</button>
        </form>
      </div>

      <div className="players-list">
        {players.map(p => (
          <div key={p.id} className="player-row-card">
            {editing === p.id ? (
              <div className="form-row" style={{ flex: 1 }}>
                <input className="input" value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} placeholder="Name" />
                <select className="input select-auto" value={editData.timezone || ''} onChange={e => setEditData(d => ({ ...d, timezone: e.target.value }))}>
                  {TZ.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input className="input" type="date" value={editData.joined_date || ''} onChange={e => setEditData(d => ({ ...d, joined_date: e.target.value }))} title="Join date" />
                <button className="btn btn-sm" onClick={() => saveEdit(p)}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="avatar" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <a href={`#/player/${p.id}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
                      onMouseOver={e => e.target.style.color='var(--accent)'}
                      onMouseOut={e => e.target.style.color='var(--text)'}
                    >{p.name}</a>
                    {p.timezone && <span className={`tz-badge tz-${p.timezone}`}>{p.timezone}</span>}
                  </div>
                  {p.joined_date && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: '0.15rem' }}>
                      Joined {fmtDate(p.joined_date)}
                    </div>
                  )}
                </div>
                <a href={`#/player/${p.id}`} className="btn btn-sm btn-secondary">Profile →</a>
                <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(p.id); setEditData({ name: p.name, timezone: p.timezone, joined_date: p.joined_date || '' }) }}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button>
              </>
            )}
          </div>
        ))}
        {players.length === 0 && <div className="empty-state">No players yet. Add one above.</div>}
      </div>
    </div>
  )
}
