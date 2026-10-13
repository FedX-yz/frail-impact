import { Component } from 'react';

// If anything crashes, show this instead of a blank page. Your save lives in
// localStorage and isn't touched, so reloading puts you back where you were.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('Frail Impact crashed:', error, info?.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ height: '100dvh', background: '#1a2035', color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ color: '#ff8c00', fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>SOMETHING BROKE</div>
        <div style={{ color: '#aab', maxWidth: 420, lineHeight: 1.5 }}>The game hit an error. Your progress is saved, so reloading should put you back where you were.</div>
        <code style={{ color: '#f87171', fontSize: 12, maxWidth: '90vw', overflowWrap: 'anywhere' }}>{String(this.state.error?.message ?? this.state.error)}</code>
        <button onClick={() => window.location.reload()}
          style={{ background: '#ff8c00', border: 'none', color: '#1a1000', fontWeight: 900, fontSize: 16, padding: '10px 28px', borderRadius: 8, cursor: 'pointer' }}>
          Reload
        </button>
      </div>
    );
  }
}
