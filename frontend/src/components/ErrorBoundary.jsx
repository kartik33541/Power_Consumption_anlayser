import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary] Section "${this.props.name || 'Unknown'}" failed to render:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="section-wrapper error-boundary-fallback"
          role="alert"
          style={{
            padding: 'var(--space-2xl) var(--space-md)',
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            margin: 'var(--space-xl) auto',
            maxWidth: '680px'
          }}
        >
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', marginBottom: '12px', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <h3 style={{ fontSize: '1.15rem', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            This section failed to load
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 16px 0', fontFamily: 'var(--font-mono)' }}>
            {this.props.name ? `[${this.props.name}] ` : ''}{this.state.error?.message || 'Unexpected runtime error'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Retry Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
