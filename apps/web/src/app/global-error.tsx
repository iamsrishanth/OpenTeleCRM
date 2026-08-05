'use client'

/**
 * Global error boundary — Next 16 prerenders this page at build time and the
 * framework's own error page crashes with `Cannot read properties of null
 * (reading 'useContext')` (vercel/next.js #86178, discussion #94667). An
 * explicit minimal boundary that owns its own <html>/<body> and touches no
 * layout-level context avoids the broken internal render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: '3rem', fontFamily: 'system-ui, sans-serif' }}>
        <h2>Something went wrong</h2>
        <p style={{ color: '#666' }}>{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
