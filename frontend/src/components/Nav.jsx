import React from 'react'

const LINKS = [
  ['grid', 'Grid'],
  ['leaderboard', 'Leaderboard'],
  ['compare', 'Compare'],
  ['players', 'Players'],
  ['periods', 'Periods'],
]

export default function Nav({ route, onLogout }) {
  return (
    <nav className="nav">
      <a href="#/" className="nav-title">⚔ Kills Tracker</a>
      <div className="nav-links">
        {LINKS.map(([key, label]) => (
          <a key={key} href={`#/${key === 'grid' ? '' : key}`} className={`nav-link${route === key ? ' active' : ''}`}>{label}</a>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  )
}
