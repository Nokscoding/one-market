import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('One Market runtime error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = this.state.error?.message || String(this.state.error)
    return (
      <main style={{ minHeight: '100vh', background: '#07172b', color: '#fff', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section style={{ width: 'min(760px,100%)', background: '#fff', color: '#172033', borderRadius: 18, padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.14em', color: '#1769e0' }}>ONE MARKET · DIAGNOSTIC</div>
          <h1 style={{ marginBottom: 10 }}>Une erreur empêche l’affichage.</h1>
          <p style={{ color: '#667085' }}>Copie ou photographie le message ci-dessous et envoie-le dans le chat.</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f3f5f7', borderRadius: 12, padding: 16, overflow: 'auto' }}>{message}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, minHeight: 44, padding: '0 18px', border: 0, borderRadius: 10, background: '#1769e0', color: '#fff', fontWeight: 800 }}>Réessayer</button>
        </section>
      </main>
    )
  }
}
