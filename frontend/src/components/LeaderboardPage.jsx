import React, { useState, useEffect } from 'react'
import { getLeaderboard, getMonthly, upsertMonthly } from '../api'
import { useToast } from '../App'

const MEDALS = ['🥇', '🥈', '🥉']

function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function LeaderboardPage() {
  const showToast = useToast()
  const [month, setMonth] = useState(defaultMonth)
  const [rows, setRows] = useState([])
  const [editingMonthly, setEditingMonthly] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [sortKey, setSortKey] = useState('weighted_score')
  const [err, setErr] = useState('')

  async function load() {
    try {
      setRows(await getLeaderboard(month))
    } catch (e) { setErr(e.message) }
  }

  useEffect(() => { load() }, [month])

  const sorted = [...rows].sort((a, b) => b[sortKey] - a[sortKey]).map((r, i) => ({ ...r, displayRank: i + 1 }))

  async function saveMonthly(row) {
    const [year, m] = month.split('-').map(Number)
    try {
      await upsertMonthly(row.player.id, year, m, editVal === '' ? null : parseInt(editVal))
      showToast('Monthly total saved')
      setEditingMonthly(null)
      load()
    } catch (e) { showToast(e.message, 'error') }
  }

  const SORT_COLS = [
    ['weighted_score', 'Merit Score ↓'],
    ['monthly_total', 'Monthly Total ↓'],
    ['daily_total', 'Daily Total ↓'],
    ['tagtime_total', 'Tagtime ↓'],
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Leaderboard</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" className="input" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
            {SORT_COLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      {err && <p className="error">{err}</p>}

      <div className="card info-banner">
        <span className="info-icon">ℹ</span>
        <span><strong>Merit Score</strong> = daily kills × period weight. Tower Week (Jul 1–7) counts ×2, Farm Phase counts ×1. Click any <em>Monthly Total</em> cell to enter the verified figure.</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>#</th>
              <th>Player</th>
              <th className="num" title="Daily kills × period weights">Merit Score</th>
              <th className="num" title="Sum of daily entries">Daily Total</th>
              <th className="num" title="Verified monthly figure — click to edit">Monthly Total</th>
              <th className="num">Tagtime (h)</th>
              <th className="num">Days</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.player.id} className={i < 3 ? 'top-row' : ''}>
                <td>
                  <span className={`rank-cell rank-${i + 1}`}>
                    {MEDALS[i] || `#${r.displayRank}`}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{r.player.name}</span>
                    {r.player.tag && <span className="tag">{r.player.tag}</span>}
                    {r.player.timezone && <span className={`tz-badge tz-${r.player.timezone}`}>{r.player.timezone}</span>}
                  </div>
                </td>
                <td className="num merit-score">{r.weighted_score.toLocaleString()}</td>
                <td className="num">{r.daily_total.toLocaleString()}</td>
                <td className="num monthly-cell" onClick={() => { setEditingMonthly(r.player.id); setEditVal(r.monthly_total != null ? String(r.monthly_total) : '') }}>
                  {editingMonthly === r.player.id ? (
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        className="input input-sm"
                        type="number"
                        min="0"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveMonthly(r); if (e.key === 'Escape') setEditingMonthly(null) }}
                        autoFocus
                        style={{ width: 90, textAlign: 'right' }}
                      />
                      <button className="btn btn-sm" onClick={() => saveMonthly(r)}>✓</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingMonthly(null)}>✕</button>
                    </div>
                  ) : (
                    <span className={`monthly-val${r.monthly_total == null ? ' monthly-empty' : ''}`}>
                      {r.monthly_total != null ? r.monthly_total.toLocaleString() : '+ enter'}
                    </span>
                  )}
                </td>
                <td className="num">{r.tagtime_total > 0 ? r.tagtime_total : <span className="muted">—</span>}</td>
                <td className="num">{r.days_active > 0 ? r.days_active : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
            No data yet for this month. Start entering kills in the Grid.
          </p>
        )}
      </div>
    </div>
  )
}
