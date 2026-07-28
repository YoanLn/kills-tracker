import React, { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getPlayers, getCompare } from '../api'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ComparePage() {
  const [month, setMonth] = useState(defaultMonth)
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState([])
  const [data, setData] = useState(null)
  const [cumulative, setCumulative] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    getPlayers().then(ps => { setPlayers(ps) }).catch(e => setErr(e.message))
  }, [])

  useEffect(() => {
    if (selected.length === 0) { setData(null); return }
    setErr('')
    getCompare(month, selected).then(setData).catch(e => setErr(e.message))
  }, [month, selected])

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const chartData = useMemo(() => {
    if (!data) return []
    if (!cumulative) return data.days
    const running = {}
    return data.days.map(pt => {
      const out = { day: pt.day, date: pt.date }
      for (const id of selected) {
        const k = pt[String(id)]
        if (k != null) running[id] = (running[id] || 0) + k
        out[String(id)] = running[id] ?? null
      }
      return out
    })
  }, [data, cumulative, selected])

  const playerColor = {}
  players.forEach((p, i) => { playerColor[p.id] = COLORS[i % COLORS.length] })

  return (
    <div>
      <div className="page-header">
        <h1>Compare</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input type="month" className="input" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <div className="btn-group">
            <button className={`btn btn-sm${!cumulative ? '' : ' btn-secondary'}`} onClick={() => setCumulative(false)}>Daily</button>
            <button className={`btn btn-sm${cumulative ? '' : ' btn-secondary'}`} onClick={() => setCumulative(true)}>Cumulative</button>
          </div>
        </div>
      </div>

      {err && <p className="error">{err}</p>}

      <div className="card">
        <h3 className="card-title">Select players to compare</h3>
        <div className="player-selector">
          {players.map((p, i) => {
            const color = COLORS[i % COLORS.length]
            const checked = selected.includes(p.id)
            return (
              <label key={p.id} className={`player-chip${checked ? ' selected' : ''}`} style={checked ? { borderColor: color, background: color + '18' } : {}}>
                <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} style={{ display: 'none' }} />
                <span className="player-chip-dot" style={{ background: color }} />
                <span>{p.name}</span>
                {p.timezone && <span className={`tz-badge tz-${p.timezone}`}>{p.timezone}</span>}
              </label>
            )
          })}
        </div>
      </div>

      {selected.length === 0 && (
        <div className="empty-state">Select at least one player above to see the chart.</div>
      )}

      {chartData.length > 0 && (
        <div className="card">
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={45} />
              <Tooltip
                contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e4e8ef' }}
                formatter={(val, name) => [val ?? '—', data?.players[name] || name]}
                labelFormatter={label => `Day ${label}`}
              />
              <Legend
                formatter={name => data?.players[name] || name}
                wrapperStyle={{ fontSize: 13 }}
              />
              {selected.map(id => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={String(id)}
                  name={String(id)}
                  stroke={playerColor[id]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: playerColor[id] }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
