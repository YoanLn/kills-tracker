import React, { useState, useEffect } from 'react'
import { getLeaderboard, getMonthly, upsertMonthly, updatePlayer, getToken } from '../api'
import { useToast } from '../App'

const MEDALS = ['🥇', '🥈', '🥉']
const HAT_LIMIT = 30

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
  const [showHatList, setShowHatList] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    try {
      setRows(await getLeaderboard(month))
    } catch (e) { setErr(e.message) }
  }

  useEffect(() => { load() }, [month])

  const sorted = [...rows].sort((a, b) => b[sortKey] - a[sortKey]).map((r, i) => ({ ...r, displayRank: i + 1 }))
  const displayed = showHatList ? sorted.filter(r => r.player.hat) : sorted
  const hatCount = rows.filter(r => r.player.hat).length
  const periodCols = rows[0]?.period_breakdown || []

  async function toggleHat(row) {
    const newHat = !row.player.hat
    try {
      await updatePlayer(row.player.id, { hat: newHat })
      setRows(prev => prev.map(r =>
        r.player.id === row.player.id ? { ...r, player: { ...r.player, hat: newHat } } : r
      ))
    } catch (e) { showToast(e.message, 'error') }
  }

  async function saveMonthly(row) {
    const [year, m] = month.split('-').map(Number)
    try {
      await upsertMonthly(row.player.id, year, m, { kills: editVal === '' ? null : parseInt(editVal) })
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
        <h1>
          Leaderboard
          <span className={`count-chip${hatCount >= HAT_LIMIT ? ' chip-full' : ''}`} style={{ marginLeft: '0.5rem' }}>
            🎩 {hatCount} / {HAT_LIMIT}
          </span>
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            className="btn btn-sm btn-secondary"
            href={`/api/export?month=${month}&token=${getToken()}`}
            download
          >
            ↓ CSV
          </a>
          <button
            className={`btn btn-sm${showHatList ? '' : ' btn-secondary'}`}
            onClick={() => setShowHatList(h => !h)}
          >
            {showHatList ? '← All players' : '🎩 Hat list'}
          </button>
          <input type="month" className="input" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
            {SORT_COLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      {err && <p className="error">{err}</p>}

      {showHatList ? (
        <div className="card">
          <h3 className="card-title">Hat Recipients — {hatCount} / {HAT_LIMIT}</h3>
          {hatCount === 0 ? (
            <p className="muted">No hats allocated yet. Check players on the leaderboard.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {sorted.filter(r => r.player.hat).map((r, i) => (
                <div key={r.player.id} className="hat-chip">
                  <span className="hat-chip-rank">#{i + 1}</span>
                  <span>{r.player.name}</span>
                  {r.player.timezone && <span className={`tz-badge tz-${r.player.timezone}`}>{r.player.timezone}</span>}
                  <button className="hat-chip-remove" onClick={() => toggleHat(r)} title="Remove hat">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card info-banner">
          <span className="info-icon">ℹ</span>
          <span><strong>Merit Score</strong> = (daily kills × period weight) + (tagtime × 10). <strong>War Phase</strong> (Jul 6–14) ×2, <strong>Chill Phase</strong> (Jul 15–30) ×1. Tagtime counts as 10 kills/h. Click <em>Monthly</em> to enter the verified figure. Check <strong>🎩</strong> to allocate a hat.</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>🎩</th>
              <th style={{ width: 56 }}>#</th>
              <th>Player</th>
              <th className="num" title="Daily kills × period weights">Merit Score</th>
              {periodCols.map(p => (
                <th key={p.id} className="num" title={`Kills during ${p.name} (×${p.weight})`}>
                  {p.name}
                  <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>×{p.weight}</div>
                </th>
              ))}
              <th className="num" title="Verified monthly figure — click to edit">Monthly</th>
              <th className="num">Tagtime</th>
              <th className="num">Days</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => (
              <tr key={r.player.id} className={i < 3 && !showHatList ? 'top-row' : ''}>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="hat-checkbox"
                    checked={!!r.player.hat}
                    onChange={() => toggleHat(r)}
                    disabled={!r.player.hat && hatCount >= HAT_LIMIT}
                    title={!r.player.hat && hatCount >= HAT_LIMIT ? `Hat limit (${HAT_LIMIT}) reached` : ''}
                  />
                </td>
                <td>
                  <span className={`rank-cell rank-${r.displayRank}`}>
                    {!showHatList && MEDALS[i] ? MEDALS[i] : `#${r.displayRank}`}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <a href={`#/player/${r.player.id}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
                      onMouseOver={e => e.target.style.color = 'var(--accent)'}
                      onMouseOut={e => e.target.style.color = 'var(--text)'}
                    >{r.player.name}</a>
                    {r.player.timezone && <span className={`tz-badge tz-${r.player.timezone}`}>{r.player.timezone}</span>}
                  </div>
                </td>
                <td className="num merit-score">{r.weighted_score.toLocaleString()}</td>
                {(r.period_breakdown || []).map(p => (
                  <td key={p.id} className="num" style={{ color: p.weight > 1 ? '#f87171' : 'var(--text)' }}>
                    {p.kills > 0 ? p.kills.toLocaleString() : <span className="muted">—</span>}
                  </td>
                ))}
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
                <td className="num">{r.tagtime_total > 0 ? `${r.tagtime_total}h` : <span className="muted">—</span>}</td>
                <td className="num">{r.days_active > 0 ? r.days_active : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
            No data yet for this month.
          </p>
        )}
      </div>
    </div>
  )
}
