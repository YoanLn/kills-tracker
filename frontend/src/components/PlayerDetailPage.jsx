import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getPlayer, getEntries, upsertEntry, getMonthly, upsertMonthly, getLeaderboard, updatePlayer } from '../api'
import { useToast } from '../App'

const TZ = [{ value: '', label: 'No timezone' }, { value: 'EU', label: 'Europe' }, { value: 'NA', label: 'NA' }, { value: 'AS', label: 'Asia' }]

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
function getDays(month) {
  const [y, m] = month.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => i + 1)
}
function datStr(month, day) {
  return `${month}-${String(day).padStart(2, '0')}`
}
function fmtDay(month, day) {
  const d = new Date(datStr(month, day) + 'T00:00:00')
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}
function isWeekend(month, day) {
  const d = new Date(datStr(month, day) + 'T00:00:00').getDay()
  return d === 0 || d === 6
}

export default function PlayerDetailPage({ id }) {
  const showToast = useToast()
  const [player, setPlayer] = useState(null)
  const [month, setMonth] = useState(defaultMonth)
  const [entries, setEntries] = useState({})
  const [stats, setStats] = useState(null)
  const [monthlyTotal, setMonthlyTotal] = useState(null)
  const [editingMonthly, setEditingMonthly] = useState(false)
  const [monthlyVal, setMonthlyVal] = useState('')
  const [editing, setEditing] = useState(null)
  const [editKills, setEditKills] = useState('')
  const [editTagtime, setEditTagtime] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({})
  const killsRef = useRef(null)

  const load = useCallback(async () => {
    const [p, allEntries, monthly, lb] = await Promise.all([
      getPlayer(id),
      getEntries(month),
      getMonthly(month),
      getLeaderboard(month),
    ])
    setPlayer(p)
    setEntries(allEntries[String(id)] || {})
    setMonthlyTotal(monthly[String(id)] ?? null)
    setMonthlyVal(monthly[String(id)] != null ? String(monthly[String(id)]) : '')
    const row = lb.find(r => r.player.id === id)
    setStats(row || null)
  }, [id, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (editing && killsRef.current) killsRef.current.focus() }, [editing])

  function startEdit(day) {
    const ds = datStr(month, day)
    const e = entries[ds] || {}
    setEditKills(e.kills != null ? String(e.kills) : '')
    setEditTagtime(e.tagtime != null ? String(e.tagtime) : '')
    setEditing(ds)
  }

  async function saveEntry(advanceNext = false) {
    if (!editing || saving) return
    setSaving(true)
    try {
      const kills = editKills === '' ? null : parseInt(editKills)
      const tagtime = editTagtime === '' ? null : parseFloat(editTagtime)
      const result = await upsertEntry(id, editing, kills, tagtime)
      const updatedEntries = { ...entries, [editing]: { kills: result.kills, tagtime: result.tagtime } }
      setEntries(updatedEntries)
      showToast('Saved')
      if (advanceNext) {
        const days = getDays(month)
        const [year, mon] = month.split('-').map(Number)
        const currentDay = new Date(editing + 'T00:00:00').getDate()
        const nextDay = days.find(d => {
          if (d <= currentDay) return false
          const ds = datStr(month, d)
          const e = updatedEntries[ds]
          return !e || (e.kills == null && e.tagtime == null)
        })
        if (nextDay) {
          setEditKills('')
          setEditTagtime('')
          setEditing(datStr(month, nextDay))
        } else {
          setEditing(null)
        }
      } else {
        setEditing(null)
        load()
      }
    } catch (e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  function startEditProfile() {
    setProfileData({ name: player.name, timezone: player.timezone || '', joined_date: player.joined_date || '' })
    setEditingProfile(true)
  }

  async function saveProfile() {
    try {
      await updatePlayer(id, { ...profileData, joined_date: profileData.joined_date || null })
      setEditingProfile(false)
      showToast('Profile updated')
      load()
    } catch (e) { showToast(e.message, 'error') }
  }

  async function saveMonthly() {
    const [y, m] = month.split('-').map(Number)
    try {
      await upsertMonthly(id, y, m, monthlyVal === '' ? null : parseInt(monthlyVal))
      setEditingMonthly(false)
      showToast('Monthly total saved')
      load()
    } catch (e) { showToast(e.message, 'error') }
  }

  if (!player) return <div className="main-content"><p className="muted">Loading…</p></div>

  const days = getDays(month)
  const [year, mon] = month.split('-').map(Number)

  const joinedThisMonth = player.joined_date && (() => {
    const j = new Date(player.joined_date + 'T00:00:00')
    return j.getFullYear() === year && j.getMonth() + 1 === mon
  })()

  return (
    <div>
      {/* Header */}
      <a href="#/players" className="back-link">← Players</a>

      <div className="profile-header">
        <div className="avatar avatar-lg" style={{ background: avatarColor(player.name) }}>
          {initials(player.name)}
        </div>
        <div className="profile-info">
          {editingProfile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ width: 180 }}
                  value={profileData.name}
                  onChange={e => setProfileData(d => ({ ...d, name: e.target.value }))}
                  placeholder="Name"
                  autoFocus
                />
                <select className="input select-auto" value={profileData.timezone} onChange={e => setProfileData(d => ({ ...d, timezone: e.target.value }))}>
                  {TZ.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input className="input" type="date" style={{ width: 'auto' }} value={profileData.joined_date} onChange={e => setProfileData(d => ({ ...d, joined_date: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-sm" onClick={saveProfile}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-name-row">
                <h1 className="profile-name">{player.name}</h1>
                {player.timezone && <span className={`tz-badge tz-${player.timezone}`}>{player.timezone}</span>}
                <button className="btn btn-sm btn-secondary" style={{ marginLeft: '0.25rem' }} onClick={startEditProfile}>Edit</button>
              </div>
              {player.joined_date ? (
                <div className="profile-joined">
                  Joined <strong>{fmtDate(player.joined_date)}</strong>
                  {joinedThisMonth && <span className="late-badge">joined mid-month</span>}
                </div>
              ) : (
                <div className="profile-joined" style={{ color: 'var(--muted)' }}>No join date — <button className="btn btn-sm btn-secondary" style={{ marginLeft: '0.2rem' }} onClick={startEditProfile}>set one</button></div>
              )}
            </>
          )}
        </div>
        <input type="month" className="input" style={{ width: 'auto', marginLeft: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-label">Merit Score</div>
            <div className="stat-card-value merit">{stats.weighted_score.toLocaleString()}</div>
            <div className="stat-card-sub">weighted kills</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Daily Total</div>
            <div className="stat-card-value">{stats.daily_total.toLocaleString()}</div>
            <div className="stat-card-sub">from {stats.days_active} days</div>
          </div>
          <div className="stat-card monthly-stat-card" onClick={() => setEditingMonthly(true)} title="Click to edit">
            <div className="stat-card-label">Monthly Total <span style={{ fontSize: 10, opacity: 0.6 }}>(click to edit)</span></div>
            {editingMonthly ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={monthlyVal}
                  onChange={e => setMonthlyVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveMonthly(); if (e.key === 'Escape') setEditingMonthly(false) }}
                  autoFocus
                  style={{ width: 100 }}
                />
                <button className="btn btn-sm" onClick={saveMonthly}>✓</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditingMonthly(false)}>✕</button>
              </div>
            ) : (
              <>
                <div className={`stat-card-value${monthlyTotal == null ? ' muted' : ''}`}>
                  {monthlyTotal != null ? monthlyTotal.toLocaleString() : '+ enter'}
                </div>
                <div className="stat-card-sub">verified figure</div>
              </>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Tagtime</div>
            <div className="stat-card-value">{stats.tagtime_total > 0 ? `${stats.tagtime_total}h` : '—'}</div>
            <div className="stat-card-sub">total hours</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Days Active</div>
            <div className="stat-card-value">{stats.days_active}</div>
            <div className="stat-card-sub">of {days.length} days</div>
          </div>
        </div>
      )}

      {/* Daily entries */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
            Daily Entries — {new Date(year, mon - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Kills</th>
              <th className="num">Tagtime</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const ds = datStr(month, day)
              const e = entries[ds] || {}
              const hasData = e.kills != null || e.tagtime != null
              const isEditing = editing === ds
              const weekend = isWeekend(month, day)

              const joinedAfter = player.joined_date && new Date(ds + 'T00:00:00') < new Date(player.joined_date + 'T00:00:00')

              return (
                <tr key={day} style={weekend ? { opacity: 0.6 } : joinedAfter ? { opacity: 0.35 } : {}}>
                  <td>
                    <span style={{ fontWeight: hasData ? 600 : 400, fontSize: 13 }}>{fmtDay(month, day)}</span>
                    {joinedAfter && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>before join</span>}
                  </td>
                  <td className="num">
                    {isEditing ? (
                      <input ref={killsRef} className="input input-sm" type="number" min="0" value={editKills} onChange={e => setEditKills(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEntry(true)} style={{ width: 80, textAlign: 'right' }} />
                    ) : (
                      e.kills != null ? <span className="kills-val">{e.kills.toLocaleString()}</span> : <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">
                    {isEditing ? (
                      <input className="input input-sm" type="number" min="0" step="0.5" value={editTagtime} onChange={e => setEditTagtime(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEntry(true); if (e.key === 'Escape') setEditing(null) }} style={{ width: 80, textAlign: 'right' }} />
                    ) : (
                      e.tagtime != null ? <span>{e.tagtime}h</span> : <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm" onClick={() => saveEntry(true)} disabled={saving} title="Save and open next empty day">Save →</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => saveEntry(false)} disabled={saving}>✓</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-secondary" onClick={() => startEdit(day)}>
                        {hasData ? 'Edit' : '+ Add'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
