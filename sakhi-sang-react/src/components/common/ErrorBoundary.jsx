import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) { return { hasError: true, error }; }

  componentDidCatch(error, info) {
    console.error('Tab error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state">
          <div className="error-icon">⚠</div>
          <h3>Something went wrong</h3>
          <p className="text-muted">{String(this.state.error?.message || this.state.error)}</p>
          <button className="btn-outline" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
