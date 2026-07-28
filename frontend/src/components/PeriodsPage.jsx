import React, { useState, useEffect } from 'react'
import { getPeriods, addPeriod, updatePeriod, deletePeriod } from '../api'
import { useToast } from '../App'

export default function PeriodsPage() {
  const showToast = useToast()
  const [periods, setPeriods] = useState([])
  const [form, setForm] = useState({ name: '', date_start: '', date_end: '', weight: '1.0' })
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})

  async function load() { setPeriods(await getPeriods()) }
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      await addPeriod({ ...form, weight: parseFloat(form.weight) })
      setForm({ name: '', date_start: '', date_end: '', weight: '1.0' })
      load(); showToast('Period added')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function saveEdit(p) {
    try {
      await updatePeriod(p.id, { ...editData, weight: parseFloat(editData.weight) })
      setEditing(null); load(); showToast('Period updated')
    } catch (err) { showToast(err.message, 'error') }
  }

  async function remove(p) {
    if (!confirm(`Delete period "${p.name}"?`)) return
    try { await deletePeriod(p.id); load(); showToast('Period deleted', 'error') }
    catch (err) { showToast(err.message, 'error') }
  }

  function weightColor(w) {
    if (w >= 2) return '#f59e0b'
    if (w > 1) return '#10b981'
    return '#64748b'
  }

  return (
    <div>
      <div className="page-header">
        <h1>Periods & Weights</h1>
      </div>

      <div className="card info-banner">
        <span className="info-icon">ℹ</span>
        <span>Define date ranges with a weight multiplier. <strong>×2</strong> means kills during that period count double in the Merit Score. Days not covered by any period default to ×1.</span>
      </div>

      {/* Visual timeline */}
      {periods.length > 0 && (
        <div className="card">
          <h3 className="card-title">Timeline</h3>
          <div className="period-timeline">
            {periods.map(p => (
              <div key={p.id} className="period-bar" style={{ background: weightColor(p.weight) + '22', borderLeft: `4px solid ${weightColor(p.weight)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ color: weightColor(p.weight) }}>{p.name}</strong>
                  <span className="weight-badge" style={{ background: weightColor(p.weight) }}>×{p.weight}</span>
                </div>
                <div className="period-dates">{p.date_start} → {p.date_end}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="card">
        <h3 className="card-title">All Periods</h3>
        {periods.map(p => (
          <div key={p.id} className="period-row">
            {editing === p.id ? (
              <div className="form-row" style={{ flex: 1 }}>
                <input className="input" value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} placeholder="Name" />
                <input className="input" type="date" value={editData.date_start || ''} onChange={e => setEditData(d => ({ ...d, date_start: e.target.value }))} />
                <input className="input" type="date" value={editData.date_end || ''} onChange={e => setEditData(d => ({ ...d, date_end: e.target.value }))} />
                <input className="input" type="number" step="0.1" min="0" value={editData.weight || ''} onChange={e => setEditData(d => ({ ...d, weight: e.target.value }))} placeholder="×" style={{ width: 70 }} />
                <button className="btn btn-sm" onClick={() => saveEdit(p)}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span className="weight-badge" style={{ background: weightColor(p.weight) }}>×{p.weight}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{p.date_start} → {p.date_end}</span>
                  </div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(p.id); setEditData({ name: p.name, date_start: p.date_start, date_end: p.date_end, weight: String(p.weight) }) }}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button>
              </>
            )}
          </div>
        ))}
        {periods.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No periods defined. Days default to ×1 weight.</p>}
      </div>

      <div className="card">
        <h3 className="card-title">Add Period</h3>
        <form onSubmit={submit} className="form-row">
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. Tower Week)" required />
          <input className="input" type="date" value={form.date_start} onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))} required />
          <input className="input" type="date" value={form.date_end} onChange={e => setForm(f => ({ ...f, date_end: e.target.value }))} required />
          <input className="input" type="number" step="0.1" min="0" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="Weight" style={{ width: 80 }} required />
          <button className="btn" type="submit">+ Add</button>
        </form>
      </div>
    </div>
  )
}
