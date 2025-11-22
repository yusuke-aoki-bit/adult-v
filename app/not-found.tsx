// This page renders when a route is not found at the root level
// Due to next-intl middleware, most routes should be locale-prefixed
export default function RootNotFound() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <title>404 - ページが見つかりません | ADULT VIEWER LAB</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '28rem',
          width: '100%',
          backgroundColor: '#1f2937',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          margin: '1rem'
        }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
            404
          </h1>
          <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>
            ページが見つかりません
          </p>
          <a
            href="/ja"
            style={{
              display: 'inline-block',
              backgroundColor: '#e11d48',
              color: 'white',
              fontWeight: '500',
              padding: '0.5rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none'
            }}
          >
            ホームに戻る
          </a>
        </div>
      </body>
    </html>
  );
}
