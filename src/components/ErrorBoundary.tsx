'use client';

import React from 'react';

interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 32,
          background: '#fff', fontFamily: 'monospace', zIndex: 9999,
        }}>
          <h2 style={{ color: '#c5221f', marginBottom: 12 }}>Runtime Error</h2>
          <pre style={{
            background: '#fef3f2', border: '1px solid #f5c2c7', borderRadius: 8,
            padding: 16, maxWidth: 800, overflowX: 'auto', fontSize: 12, color: '#c5221f',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            style={{ marginTop: 20, padding: '8px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
