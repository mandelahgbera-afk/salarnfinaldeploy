import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Salarn] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#070c18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, -apple-system, sans-serif',
          padding: '24px',
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: '#0d1424',
            border: '1px solid #1a2540',
            borderRadius: '20px',
            padding: '48px 40px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '28px',
            }}>▲</div>
            <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
              Salarn
            </h1>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, margin: '0 0 32px' }}>
              Something went wrong loading the app. This is usually caused by missing Supabase environment variables on your deployment.
            </p>
            <div style={{
              background: '#0a1120',
              border: '1px solid #1a2540',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '28px',
              textAlign: 'left',
            }}>
              <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Required environment variables
              </p>
              <p style={{ color: '#22c55e', fontSize: '13px', fontFamily: 'monospace', margin: '4px 0' }}>VITE_SUPABASE_URL</p>
              <p style={{ color: '#22c55e', fontSize: '13px', fontFamily: 'monospace', margin: '4px 0' }}>VITE_SUPABASE_ANON_KEY</p>
            </div>
            <p style={{ color: '#475569', fontSize: '13px', margin: '0 0 24px' }}>
              Add these in your Vercel project settings under <strong style={{ color: '#64748b' }}>Environment Variables</strong>, then redeploy.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 32px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
