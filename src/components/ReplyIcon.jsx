export default function ReplyIcon({ size = 16, style }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <polyline points="9 5 3 11 9 17" />
      <path d="M3 11h11c4 0 7 2.5 7 7" />
    </svg>
  )
}
