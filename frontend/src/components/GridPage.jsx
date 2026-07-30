import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getPlayers, getEntries, upsertEntry } from '../api'
import { useToast } from '../App'

const KILLS_TIERS = [
  [200, 'cell-kills-4'],
  [100, 'cell-kills-3'],
  [40,  'cell-kills-2'],
  [1,   'cell-kills-1'],
  [0,   'cell-kills-0'],
]

function killsClass(kills) {
  if (kills == null) return ''
  for (const [threshold, cls] of KILLS_TIERS) {
    if (kills >= threshold) return cls
  }
  return ''
}

function getDays(month) {
  const [y, m] = month.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => i + 1)
}

function datStr(month, day) {
  return `${month}-${String(day).padStart(2, '0')}`
}

function fmtDay(month, day) {
  const d = new Date(datStr(month, day))
  return d.toLocaleDateString('en', { weekday: 'short' })
}

function isWeekend(month, day) {
  const d = new Date(datStr(month, day)).getDay()
  return d === 0 || d === 6
}

function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function GridPage() {
  const showToast = useToast()
  const [month, setMonth] = useState(defaultMonth)
  const [players, setPlayers] = useState([])
  const [entries, setEntries] = useState({})
  const [cell, setCell] = useState(null)
  const [cellKills, setCellKills] = useState('')
  const [saving, setSaving] = useState(false)
  const killsRef = useRef(null)

  const load = useCallback(async () => {
    const [ps, es] = await Promise.all([getPlayers(), getEntries(month)])
    setPlayers(ps)
    setEntries(es)
  }, [month])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (cell && killsRef.current) killsRef.current.focus()
  }, [cell])

  function openCell(e, playerId, dateStr) {
    const rect = e.currentTarget.getBoundingClientRect()
    const existing = entries[String(playerId)]?.[dateStr] || {}
    setCellKills(existing.kills != null ? String(existing.kills) : '')
    setCell({ playerId, dateStr, x: rect.left, y: rect.bottom })
  }

  async function saveCell() {
    if (!cell || saving) return
    setSaving(true)
    try {
      const kills = cellKills === '' ? null : parseInt(cellKills)
      const result = await upsertEntry(cell.playerId, cell.dateStr, kills, null)
      setEntries(prev => ({
        ...prev,
        [String(cell.playerId)]: {
          ...(prev[String(cell.playerId)] || {}),
          [cell.dateStr]: { kills: result.kills, tagtime: result.tagtime },
        },
      }))
      showToast('Saved')
      setCell(null)
    } catch (e) {
      showToast(e.message, 'error')
    } finally { setSaving(false) }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') saveCell()
    if (e.key === 'Escape') setCell(null)
  }

  const days = getDays(month)

  return (
    <div>
      <div className="page-header">
        <h1>Daily Grid</h1>
        <input
          type="month"
          className="input"
          style={{ width: 'auto' }}
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      {players.length === 0 ? (
        <div className="empty-state">No players yet. <a href="#/players">Add players →</a></div>
      ) : (
        <div className="grid-wrapper">
          <table className="kill-grid">
            <thead>
              <tr>
                <th className="grid-player-col sticky-col">Player</th>
                {days.map(d => (
                  <th key={d} className={`grid-day-col${isWeekend(month, d) ? ' weekend-col' : ''}`}>
                    <div className="day-num">{d}</div>
                    <div className="day-name">{fmtDay(month, d)}</div>
                  </th>
                ))}
                <th className="grid-total-col">Total</th>
                <th className="grid-total-col">Tagtime</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const pe = entries[String(p.id)] || {}
                const total = Object.values(pe).reduce((s, e) => s + (e.kills ?? 0), 0)
                const tagTotal = Object.values(pe).reduce((s, e) => s + (e.tagtime ?? 0), 0)
                return (
                  <tr key={p.id}>
                    <td className="grid-player-cell sticky-col">
                      <div className="grid-player-name">{p.name}</div>
                      <div className="grid-player-meta">
                        {p.timezone && <span className={`tz-badge tz-${p.timezone}`}>{p.timezone}</span>}
                      </div>
                    </td>
                    {days.map(d => {
                      const ds = datStr(month, d)
                      const e = pe[ds]
                      return (
                        <td
                          key={d}
                          className={`grid-cell${isWeekend(month, d) ? ' weekend-col' : ''} ${killsClass(e?.kills)}`}
                          onClick={ev => openCell(ev, p.id, ds)}
                          title={e?.tagtime ? `${e.tagtime}h tagtime` : ''}
                        >
                          {e?.kills != null && <span className="cell-kills-val">{e.kills}</span>}
                          {e?.tagtime != null && <span className="cell-tag-dot" />}
                        </td>
                      )
                    })}
                    <td className="grid-summary-cell">{total > 0 ? total.toLocaleString() : <span className="muted">—</span>}</td>
                    <td className="grid-summary-cell">{tagTotal > 0 ? `${tagTotal.toFixed(1)}h` : <span className="muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="grid-legend">
        <span className="legend-label">Kills:</span>
        {[['cell-kills-0','0'],['cell-kills-1','1–39'],['cell-kills-2','40–99'],['cell-kills-3','100–199'],['cell-kills-4','200+']].map(([cls, label]) => (
          <span key={cls} className={`legend-chip ${cls}`}>{label}</span>
        ))}
        <span className="legend-dot-item"><span className="cell-tag-dot" /> tagtime set</span>
      </div>

      {/* Cell popup */}
      {cell && (
        <>
          <div className="popup-backdrop" onClick={() => setCell(null)} />
          <div
            className="cell-popup"
            style={{
              position: 'fixed',
              top: Math.min(cell.y + 6, window.innerHeight - 200),
              left: Math.min(cell.x, window.innerWidth - 230),
            }}
          >
            <div className="popup-header">
              <strong>{players.find(p => p.id === cell.playerId)?.name}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {new Date(cell.dateStr + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="popup-field">
              <label>Kills</label>
              <input ref={killsRef} className="input" type="number" min="0" value={cellKills} onChange={e => setCellKills(e.target.value)} onKeyDown={handleKeyDown} placeholder="0" />
            </div>
            <div className="popup-actions">
              <button className="btn btn-sm" onClick={saveCell} disabled={saving}>Save</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setCell(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
