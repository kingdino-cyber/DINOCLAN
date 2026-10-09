import { useState } from 'react'

// Falls back to an inline SVG (no network request) if the network blocks
// or fails to load the real logo image — e.g. school/work proxy filters.
export default function DinoLogo({ style, className, alt = 'DINOCLAN' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <svg viewBox="0 0 24 24" style={style} className={className} role="img" aria-label={alt}>
        <circle cx="12" cy="12" r="12" fill="#4caf50" />
        <path
          fill="#fff"
          d="M7.5 8.2c0-1 .8-1.9 1.9-1.9.6 0 1.1.3 1.5.7.5-.3 1.1-.5 1.8-.5 2 0 3.6 1.5 3.8 3.4.9.3 1.5 1.2 1.5 2.2 0 1.3-1.1 2.4-2.4 2.4h-.2c-.3.9-1.1 1.5-2.1 1.5-.4 0-.8-.1-1.1-.3-.4.6-1 1-1.8 1-1.2 0-2.1-1-2.1-2.1 0-.2 0-.4.1-.6-.9-.3-1.5-1.1-1.5-2.1 0-1 .6-1.8 1.5-2.1-.5-.3-.9-.9-.9-1.6z"
        />
        <circle cx="15.3" cy="9.6" r=".7" fill="#4caf50" />
      </svg>
    )
  }

  return (
    <img
      src="/dinoclan-logo.png"
      alt={alt}
      style={style}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
