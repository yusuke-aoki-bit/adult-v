import Link from 'next/link';

// This page renders when a route is not found at the root level
// Due to next-intl middleware, most routes should be locale-prefixed
// FANZA theme: Light background with rose accent colors
export default function RootNotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        margin: '1rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#B42F5A', marginBottom: '1rem' }}>
          404
        </h1>
        <p style={{ color: '#4B4B4B', marginBottom: '1.5rem' }}>
          ページが見つかりません
        </p>
        <Link
          href="/ja"
          style={{
            display: 'inline-block',
            backgroundColor: '#B42F5A',
            color: 'white',
            fontWeight: '500',
            padding: '0.5rem 1.5rem',
            borderRadius: '0.5rem',
            textDecoration: 'none'
          }}
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
