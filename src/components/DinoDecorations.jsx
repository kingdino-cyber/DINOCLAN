const DINOS = [
  // Scattered dinos & items
  { emoji: '🦕', top: '25%',  left: '1%',   size: 48, rotate: 10,   opacity: 0.06 },
  { emoji: '🦖', top: '50%',  left: '2%',   size: 60, rotate: 5,    opacity: 0.06 },
  { emoji: '🦕', top: '60%',  right: '2%',  size: 56, rotate: -10,  opacity: 0.07 },
  { emoji: '🦴', top: '72%',  left: '1%',   size: 44, rotate: 30,   opacity: 0.08 },
  { emoji: '🥚', top: '88%',  left: '3%',   size: 40, rotate: -5,   opacity: 0.08 },
  { emoji: '🦎', top: '92%',  right: '3%',  size: 44, rotate: 15,   opacity: 0.07 },
  { emoji: '🌋', top: '80%',  right: '1%',  size: 64, rotate: 0,    opacity: 0.05 },
  { emoji: '🦕', top: '55%',  left: '42%',  size: 80, rotate: 12,   opacity: 0.04 },
  { emoji: '🦖', top: '78%',  left: '48%',  size: 68, rotate: -18,  opacity: 0.04 },
  { emoji: '🦴', top: '3%',   left: '48%',  size: 40, rotate: 45,   opacity: 0.05 },
  { emoji: '🥚', top: '44%',  left: '10%',  size: 36, rotate: -12,  opacity: 0.05 },
  { emoji: '🦕', top: '20%',  right: '18%', size: 50, rotate: 8,    opacity: 0.05 },

  // Palm fronds — top-left corner
  { emoji: '🌴', top: '-2%',  left: '-1%',  size: 110, rotate: 15,  opacity: 0.13 },
  { emoji: '🌿', top: '1%',   left: '3%',   size: 72,  rotate: -20, opacity: 0.11 },
  { emoji: '🪴', top: '3%',   left: '0%',   size: 56,  rotate: 5,   opacity: 0.10 },

  // Palm fronds — top-right corner
  { emoji: '🌴', top: '-2%',  right: '-1%', size: 110, rotate: -15, opacity: 0.13 },
  { emoji: '🌿', top: '1%',   right: '3%',  size: 72,  rotate: 20,  opacity: 0.11 },
  { emoji: '🪴', top: '3%',   right: '0%',  size: 56,  rotate: -5,  opacity: 0.10 },

  // Palm fronds — bottom-left corner
  { emoji: '🌴', bottom: '-2%', left: '-1%', size: 110, rotate: -10, opacity: 0.12 },
  { emoji: '🌿', bottom: '1%',  left: '4%',  size: 68,  rotate: 15,  opacity: 0.10 },

  // Palm fronds — bottom-right corner
  { emoji: '🌴', bottom: '-2%', right: '-1%', size: 110, rotate: 10,  opacity: 0.12 },
  { emoji: '🌿', bottom: '1%',  right: '4%',  size: 68,  rotate: -15, opacity: 0.10 },

  // Extra jungle mid-screen
  { emoji: '🌿', top: '15%',  left: '45%',  size: 72,  rotate: -8,  opacity: 0.04 },
  { emoji: '🌱', top: '35%',  right: '1%',  size: 52,  rotate: -20, opacity: 0.07 },
  { emoji: '🍃', top: '8%',   right: '3%',  size: 56,  rotate: 20,  opacity: 0.07 },
  { emoji: '🍃', top: '4%',   left: '2%',   size: 48,  rotate: -15, opacity: 0.07 },
]

export default function DinoDecorations() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      {DINOS.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: d.top,
            bottom: d.bottom,
            left: d.left,
            right: d.right,
            fontSize: d.size,
            opacity: d.opacity,
            transform: `rotate(${d.rotate}deg)`,
            userSelect: 'none',
            lineHeight: 1,
            filter: 'saturate(0.7)',
          }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  )
}
