import React, { useState } from 'react'
import { login } from '../api'

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const { token } = await login(password)
      localStorage.setItem('kt_token', token)
      onLogin()
    } catch (_) {
      setErr('Wrong password')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">⚔</div>
        <h1 className="login-title">Kills Tracker</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: 13 }}>Guild activity tracker</p>
        <form onSubmit={submit}>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoFocus style={{ marginBottom: '0.75rem' }} />
          {err && <p className="error" style={{ marginBottom: '0.5rem' }}>{err}</p>}
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
