import { useState, useEffect } from 'react';

export function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return pathname;
}

export function navigate(to) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== to) {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth: '520px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
          404 • ROUTE NOT FOUND
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '16px' }}>
          This signal path does not exist.
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
          NILM Signal Lab is currently a single-page technical explainer at <code>/</code>. Future application routes are not yet released.
        </p>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '44px',
            padding: '10px 22px',
            borderRadius: '10px',
            background: 'var(--accent-cyan)',
            color: '#0b0f17',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          Return to Overview
        </a>
      </div>
    </main>
  );
}

export function PlaceholderRoute({ title }) {
  return (
    <main id="main-content" tabIndex={-1} style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth: '520px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
          COMING SOON • IN DEVELOPMENT
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '16px' }}>
          {title}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
          This route is reserved in the router structure for a future phase. The monitoring device and trained model are not yet released.
        </p>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '44px',
            padding: '10px 22px',
            borderRadius: '10px',
            background: 'var(--accent-cyan)',
            color: '#0b0f17',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          Back to Overview
        </a>
      </div>
    </main>
  );
}
