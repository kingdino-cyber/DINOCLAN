export default function LeaveIcon({ size = 14, style }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M13 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
      <path d="M13 3.5l4.5 2v13l-4.5 2" />
      <line x1="14" y1="12" x2="21" y2="12" />
      <polyline points="18 9 21 12 18 15" />
    </svg>
  )
}
