import React, { useState, useEffect } from 'react'
import { getPlayers, addPlayer, updatePlayer, deletePlayer, getMonthly, upsertMonthly } from '../api'
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
function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PlayersPage() {
  const showToast = useToast()
  const [players, setPlayers] = useState([])
  const [name, setName] = useState('')
  const [tz, setTz] = useState('')
  const [joinedDate, setJoinedDate] = useState('')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})

  // Monthly data bulk entry
  const [dataMonth, setDataMonth] = useState(defaultMonth)
  const [monthlyData, setMonthlyData] = useState({}) // {pid: {kills, tagtime}}
  const [edits, setEdits] = useState({})             // {pid: {kills: '', tagtime: ''}}
  const [saving, setSaving] = useState({})

  async function load() {
    const ps = await getPlayers()
    setPlayers(ps)
  }

  async function loadMonthly(month) {
    const data = await getMonthly(month)
    setMonthlyData(data)
    const init = {}
    players.forEach(p => {
      const m = data[String(p.id)]
      init[p.id] = {
        kills: m?.kills != null ? String(m.kills) : '',
        tagtime: m?.tagtime != null ? String(m.tagtime) : '',
      }
    })
    setEdits(init)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (players.length > 0) loadMonthly(dataMonth) }, [dataMonth, players.length])

  function setEdit(pid, field, val) {
    setEdits(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), [field]: val } }))
  }

  async function saveRow(p) {
    const e = edits[p.id] || {}
    const [year, month] = dataMonth.split('-').map(Number)
    setSaving(prev => ({ ...prev, [p.id]: true }))
    try {
      await upsertMonthly(p.id, year, month, {
        kills: e.kills === '' ? null : parseInt(e.kills),
        tagtime: e.tagtime === '' ? null : parseFloat(e.tagtime),
      })
      showToast(`${p.name} saved`)
    } catch (err) { showToast(err.message, 'error') }
    finally { setSaving(prev => ({ ...prev, [p.id]: false })) }
  }

  async function saveTz(p, tz) {
    try {
      await updatePlayer(p.id, { timezone: tz })
      setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, timezone: tz } : x))
    } catch (err) { showToast(err.message, 'error') }
  }

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

      {/* Add player */}
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

      {/* Players list */}
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

      {/* Monthly bulk data entry */}
      {players.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
              Monthly Data
            </span>
            <input type="month" className="input" style={{ width: 'auto' }} value={dataMonth} onChange={e => setDataMonth(e.target.value)} />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th style={{ width: 130 }}>Timezone</th>
                <th className="num" style={{ width: 150 }}>Monthly Kills</th>
                <th className="num" style={{ width: 150 }}>Tagtime (h)</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const e = edits[p.id] || { kills: '', tagtime: '' }
                const isSaving = saving[p.id]
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div className="avatar" style={{ background: avatarColor(p.name), width: 28, height: 28, fontSize: 11 }}>{initials(p.name)}</div>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="input"
                        style={{ width: '100%' }}
                        value={p.timezone || ''}
                        onChange={ev => saveTz(p, ev.target.value)}
                      >
                        {TZ.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="input input-sm"
                        type="number"
                        min="0"
                        value={e.kills}
                        onChange={ev => setEdit(p.id, 'kills', ev.target.value)}
                        onKeyDown={ev => ev.key === 'Enter' && saveRow(p)}
                        placeholder="—"
                        style={{ width: '100%', textAlign: 'right' }}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="input input-sm"
                        type="number"
                        min="0"
                        step="0.5"
                        value={e.tagtime}
                        onChange={ev => setEdit(p.id, 'tagtime', ev.target.value)}
                        onKeyDown={ev => ev.key === 'Enter' && saveRow(p)}
                        placeholder="—"
                        style={{ width: '100%', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-sm" onClick={() => saveRow(p)} disabled={isSaving}>
                        {isSaving ? '…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
